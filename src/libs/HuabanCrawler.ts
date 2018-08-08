import * as HTTP from "@litert/http";
import * as $Path from "path";
import * as $FS from "@litert/async-fs";
import { Async } from "@litert/core";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/68.0.3440.75 Safari/537.36";

const USER_URL_PREFIX = "http://huaban.com/users/";
const ROOT_URL_PREFIX = "http://huaban.com/";
const BOARD_URL_PREFIX = "http://huaban.com/boards/";
const PIN_URL_PREFIX = "http://huaban.com/pins/";

const ACCEPT_FOR_HTML = "text/html,application/xhtml+xml,application/xml;" +
                        "q=0.9,image/webp,image/apng,*/*;q=0.8";
export interface ICategory {

    col: number;

    id: string;

    name: string;

    nav_link: string;
}

export interface IUserBoards {

    user: IFullUserInfo;

    query_type: "boards";
}

export interface ISettings {

    imgHosts: Record<string, string>;

    categories: ICategory[];
}

export interface IUserInfo {

    created_at: number;

    pin_count: number;

    user_id: number;

    username: string;

    urlname: string;
}

export interface IFullUserInfo {

    boards: IBoardInfo[];

    board_count: number;

    boards_like_count: number;

    commodity_count: number;

    created_at: number;

    email: string;

    explore_following_count: number;

    follower_count: number;

    following_count: number;

    like_count: number;

    muse_board_count: number;

    pin_count: number;

    tag_count: number;

    urlname: string;

    user_id: number;

    username: string;

    seq: number;
}

export interface IBoardInfo {

    board_id: number;

    category_id: string;

    category_name: string;

    created_at: number;

    deleting: number;

    description: string;

    extra: null | any;

    follow_count: number;

    following: boolean;

    is_private: number;

    like_count: number;

    liked: boolean;

    pin_count: number;

    seq: number;

    title: string;

    updated_at: number;

    user_id: number;

    user: IUserInfo;

    pins: IPinInfo[];
}

export interface IPinFile {

    bucket: string;

    colors: Array<{

        color: number;

        ratio: number;
    }>;

    farm: string;

    frames: string;

    height: string;

    id: number;

    key: string;

    theme: string;

    type: string;

    width: string;
}

export interface IPinInfo {

    board_id: number;

    comment_count: number;

    created_at: number;

    extra: null;

    file: IPinFile;

    file_id: number;

    hide_origin: boolean;

    is_private: number;

    like_count: number;

    link: string | null;

    media_type: number;

    orig_source: string | null;

    original: number;

    pin_id: number;

    raw_text: string;

    repin_count: number;

    source: string | null;

    tags: string[];

    text_meta: {

        tags: string[];
    };

    user_id: number;

    via: number;

    via_user_id: number;
}

export interface IDumpResult {

    imgPath: string;

    metaPath: string;

    size: number;
}

export interface IFollowedBoards {

    boards: IBoardInfo[];

    following_count: number;
}

export interface IFollowedUsers {

    user: IFullUserInfo;

    users: IFullUserInfo[];
}

export interface IHuabanCrawler {

    initialize(): Promise<void>;

    getUserInfoByID(
        id: number
    ): Promise<IFullUserInfo>;

    getFollowedBoardsByUsername(
        username: string,
        gap?: number,
        accuracy?: number
    ): Promise<IBoardInfo[]>;

    getBoardPinListByPinId(id: number): Promise<IPinInfo[]>;

    getFollowedUsersByUsername(
        username: string,
        gap?: number,
        accuracy?: number
    ): Promise<IFullUserInfo[]>;

    getBoardsByUsername(
        username: string,
        gap?: number,
        accuracy?: number
    ): Promise<IBoardInfo[]>;

    getBoardInfo(
        id: number
    ): Promise<IBoardInfo>;

    getPinListOfBoardAjax(
        id: number,
        maxPinId: number,
        limit?: number,
        waterfall?: number
    ): Promise<IPinInfo[]>;

    getImageLink(file: IPinFile): string;

    /**
     * 将指定采集的图片下载到指定路径。
     *
     * @param path              保存路径
     * @param pin               采集信息
     * @param withPinInfo       是否将采集信息保存为同名 JSON 文件。
     * @param ignoreIfSaved     是否忽略已经下载的文件。
     *
     * @return 返回下载的文件体积（字节）。
     */
    dumpFile(
        path: string,
        pin: IPinInfo,
        withPinInfo?: boolean,
        ignoreIfSaved?: boolean
    ): Promise<IDumpResult>;

    getPinImageSize(
        pin: IPinInfo
    ): Promise<number>;
}

class HuabanCrawler
implements IHuabanCrawler {

    private _cli: HTTP.IHttpClient;

    private _cookies: Record<string, string>;

    private _uniqueId: string;

    private _settings!: ISettings;

    public constructor() {

        this._uniqueId = this._createUniqueID();
        this._cookies = {};
        this._cli = HTTP.createClient();
    }

    private _wrapHeaders(
        headers: Record<string, string> = {},
        ajax: boolean = false
    ): Record<string, string> {

        headers["Pragma"] = "no-cache";
        headers["Cache-Control"] = "no-cache";
        headers["Accept-Encoding"] = "gzip, deflate";
        headers["Accept-Language"] = "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7";
        headers["User-Agent"] = USER_AGENT;

        const cookies = this._stringifyCookies();

        if (cookies) {

            headers["Cookie"] = cookies;
        }

        if (ajax) {

            headers["X-Requested-With"] = "XMLHttpRequest";
            headers["X-Request"] = "JSON";
        }

        return headers;
    }

    public async dumpFile(
        path: string,
        pin: IPinInfo,
        withPinInfo: boolean = true,
        ignoreIfDumpped: boolean = true
    ): Promise<IDumpResult> {

        const metaPath: string = withPinInfo ?
            $Path.resolve(path, `${pin.pin_id}.json`) : "";

        let imgPath: string = "";

        switch (pin.file.type) {
        case "image/jpeg":
            imgPath = $Path.resolve(path, `${pin.pin_id}.jpg`);
            break;
        case "image/apng":
        case "image/png":
            imgPath = $Path.resolve(path, `${pin.pin_id}.png`);
            break;
        case "image/gif":
            imgPath = $Path.resolve(path, `${pin.pin_id}.gif`);
            break;
        case "image/webp":
            imgPath = $Path.resolve(path, `${pin.pin_id}.webp`);
            break;
        case "image/bmp":
            imgPath = $Path.resolve(path, `${pin.pin_id}.bmp`);
            break;
        default:
            imgPath = $Path.resolve(path, `${pin.pin_id}.unknown`);
            break;
        }

        if (ignoreIfDumpped && await $FS.exists(imgPath)) {

            /**
             * 文件已经存在，忽略。
             */
            return {

                imgPath,
                metaPath,
                size: 0
            };
        }

        let result = await this._cli.get({
            url: this.getImageLink(pin.file),
            headers: this._wrapHeaders({

                "Accept": pin.file.type,
                "Referer": `${BOARD_URL_PREFIX}${pin.board_id}/`
            }),
            timeout: 10000
        });

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        await $FS.writeFile(imgPath, result.data);

        if (metaPath) {

            await $FS.writeFile(
                metaPath,
                JSON.stringify(pin, null, 2)
            );
        }

        return {

            imgPath,
            metaPath,
            size: parseInt(result.headers["content-length"] as string)
        };
    }

    private async _getFollowedBoardsByUsername(
        username: string,
        page: number,
        perPage: number = 20,
        wfl: number = 1
    ): Promise<IFollowedBoards> {

        let result = await this._cli.get({
            url: `${ROOT_URL_PREFIX}${username}/following/boards?${
                this._uniqueId
            }&page=${
                page
            }&per_page=${
                perPage
            }&wfl=${
                wfl
            }`,
            headers: this._wrapHeaders({

                "Accept": "application/json",
                "Referer": `${ROOT_URL_PREFIX}${username}/following`
            }, true)
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        return JSON.parse(result.data.toString());
    }

    private async _getFollowedUsersByUsername(
        username: string,
        max: number,
        limit: number = 20,
        wfl: number = 1
    ): Promise<IFollowedUsers> {

        let result = await this._cli.get({
            url: `${ROOT_URL_PREFIX}${username}/following?${
                this._uniqueId
            }&max=${
                max
            }&limit=${
                limit
            }&wfl=${
                wfl
            }`,
            headers: this._wrapHeaders({

                "Accept": "application/json",
                "Referer": `${ROOT_URL_PREFIX}${username}/following`
            }, true)
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        return JSON.parse(result.data.toString());
    }

    private async _getBoardsByUsername(
        username: string,
        max: number = 0,
        limit: number = 10,
        wfl: number = 1
    ): Promise<IUserBoards> {

        let url = `${ROOT_URL_PREFIX}${username}/boards?${ this._uniqueId }`;

        if (max) {

            url += `&max=${ max }&limit=${ limit }&wfl=${ wfl }`;
        }

        let result = await this._cli.get({
            url,
            headers: this._wrapHeaders({

                "Accept": "application/json",
                "Referer": `${ROOT_URL_PREFIX}${username}`
            }, true)
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        return JSON.parse(result.data.toString());
    }

    public async getBoardsByUsername(
        username: string,
        gap: number = 0,
        accuracy: number = 1
    ): Promise<any> {

        let ret: IBoardInfo[] = [];

        do {

            let data = await this._getBoardsByUsername(
                username,
                ret.length ? Math.max(...ret.map((x) => x.board_id)) : 0
            );

            if (!data.user || !data.user.board_count) {

                break;
            }

            const user = data.user;

            if (user.board_count && user.boards.length) {

                ret = ret.concat(user.boards);
            }
            else {

                break;
            }

            if (gap) {

                await Async.sleep(Math.floor(
                    gap + gap * (1 - accuracy) * Math.random()
                ));
            }

        } while (1);

        return ret;
    }

    public async getFollowedBoardsByUsername(
        username: string,
        gap: number = 0,
        accuracy: number = 1
    ): Promise<IBoardInfo[]> {

        let page = 1;
        let ret: IBoardInfo[] = [];

        do {

            let data: IFollowedBoards = await this._getFollowedBoardsByUsername(
                username,
                page++
            );

            if (!data.following_count) {

                break;
            }

            if (data.boards.length) {

                ret = ret.concat(data.boards);
            }
            else {

                break;
            }

            if (gap) {

                await Async.sleep(Math.floor(
                    gap + gap * (1 - accuracy) * Math.random()
                ));
            }

        } while (1);

        return ret;
    }

    public async getFollowedUsersByUsername(
        username: string,
        gap: number = 0,
        accuracy: number = 1
    ): Promise<IFullUserInfo[]> {

        let ret: IFullUserInfo[] = [];

        do {

            let data: IFollowedUsers = await this._getFollowedUsersByUsername(
                username,
                ret.length > 0 ?
                    Math.min(...ret.map((x) => x.seq)) : 0xFFFFFFFF
            );

            if (data.users.length) {

                ret = ret.concat(data.users);
            }
            else {

                break;
            }

            if (gap) {

                await Async.sleep(Math.floor(
                    gap + gap * (1 - accuracy) * Math.random()
                ));
            }

        } while (1);

        return ret;
    }

    public async getUserInfoByID(
        id: number
    ): Promise<IFullUserInfo> {

        let result = await this._cli.get({
            url: `${USER_URL_PREFIX}${id}`,
            headers: this._wrapHeaders({

                "Accept": "application/json",
                "Referer": `${USER_URL_PREFIX}${id}/`
            }, true)
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        return JSON.parse(result.data.toString());
    }

    public async initialize(): Promise<void> {

        let result = await this._cli.get({
            url: ROOT_URL_PREFIX,
            headers: this._wrapHeaders({

                "Accept": ACCEPT_FOR_HTML
            })
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        const html = result.data.toString();

        const START_SIGN = 'app["settings"] = ';
        const END_SIGN = 'app["req"] = ';

        const startPos = html.indexOf(START_SIGN);

        if (startPos === -1) {

            throw new Error(`Can not translate the board page.`);
        }

        const relEndPos = html.indexOf(END_SIGN, startPos);

        if (relEndPos === -1) {

            throw new Error(`Can not translate the board page.`);
        }

        const endPos = html.lastIndexOf(";", relEndPos);

        if (endPos === -1) {

            throw new Error(`Can not translate the board page.`);
        }

        const json = html.slice(startPos + START_SIGN.length, endPos);

        if (json) {

            this._settings = JSON.parse(json);
        }
    }

    public async getBoardInfo(id: number): Promise<IBoardInfo> {

        let result = await this._cli.get({
            url: `${BOARD_URL_PREFIX}${id}/`,
            headers: this._wrapHeaders({

                "Accept": "application/json",
                "Referer": ROOT_URL_PREFIX
            }, true)
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        return JSON.parse(result.data.toString()).board;
    }

    public async getBoardPinListByPinId(id: number): Promise<IPinInfo[]> {

        let result = await this._cli.get({
            url: `${PIN_URL_PREFIX}${id}/?${this._uniqueId}`,
            headers: this._wrapHeaders({

                "Accept": "application/json",
                "Referer": `${PIN_URL_PREFIX}${id}/`
            }, true)
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        try {

            return JSON.parse(result.data.toString()).pin.board.pins;
        }
        catch {

            return [];
        }
    }

    private _decodeCookieInfo(setCookieLine: string): Record<string, any> {

        let ret: Record<string, any> = {};

        let segs = setCookieLine.split(";").map((x) => x.trim());

        const extractKeyValue = (x: string): { key: string; value: any; } => {
            const pos = x.indexOf("=");

            if (pos === -1) {

                return {
                    key: x,
                    value: true
                };
            }

            return {
                key: x.slice(0, pos),
                value: x.slice(pos + 1)
            };
        };

        let firstSeg = extractKeyValue(segs[0]);

        ret["name"] = firstSeg.key;
        ret["value"] = firstSeg.value;

        for (const seg of segs.slice(1)) {

            const info = extractKeyValue(seg);

            switch (info.key.toLowerCase()) {

            case "httponly":
            case "secure":
                ret[info.key] = true;
                break;
            case "path":
            case "domain":
                ret[info.key] = info.value;
                break;
            case "max-age":
                ret[info.key] = parseInt(info.value);
                break;
            case "expires":
                ret[info.key] = new Date(info.value).getTime();
                break;
            }
        }

        return ret;
    }

    private _updateCookies(cookies: string[]): void {

        for (let item of cookies) {

            const info = this._decodeCookieInfo(item);

            if (info.expires !== undefined) {

                if (info.expires < Date.now()) {

                    delete this._cookies[info.name];
                }
            }
            else {

                this._cookies[info.name] = info.value;
            }
        }
    }

    private _stringifyCookies(): string {

        let segs: string[] = [];

        for (let key in this._cookies) {

            segs.push(`${key}=${this._cookies[key]}`);
        }

        return segs.join("; ");
    }

    private _createUniqueID(): string {
        return Date.now().toString(36);
    }

    public async getPinListOfBoardAjax(
        id: number,
        maxPinId: number,
        limit: number = 20,
        waterfall: number = 1
    ): Promise<IPinInfo[]> {

        let result = await this._cli.get({
            url: `${BOARD_URL_PREFIX}${id}/?${this._uniqueId}&max=${maxPinId}&limit=${limit}&wfl=${waterfall}`,
            headers: this._wrapHeaders({

                "Accept": "application/json",
                "Referer": `${BOARD_URL_PREFIX}${id}/`
            }, true)
        });

        if (result.headers && result.headers["set-cookie"]) {

            this._updateCookies(result.headers["set-cookie"] as string[]);
        }

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        return JSON.parse(result.data.toString()).board.pins;
    }

    public async getPinImageSize(
        pin: IPinInfo
    ): Promise<number> {

        let result = await this._cli.head({
            url: this.getImageLink(pin.file),
            headers: this._wrapHeaders({

                "Accept": pin.file.type,
                "Referer": `${BOARD_URL_PREFIX}${pin.board_id}/`
            })
        });

        if (result.code !== 200) {

            throw result;
        }

        if (result.headers["content-length"]) {

            return parseInt(result.headers["content-length"] as string);
        }

        return 0;
    }

    public getImageLink(file: IPinFile): string {

        const bucket = this._settings.imgHosts[file.bucket + "_http"];

        return `http://${bucket}/${file.key}`;
    }
}

export function createCrawler(): IHuabanCrawler {

    return new HuabanCrawler();
}
