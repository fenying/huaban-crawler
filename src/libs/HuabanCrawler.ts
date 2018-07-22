/**
 * Copyright 2018 Angus.Fenying
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as HTTP from "./HTTPClient";
import * as $Path from "path";
import * as $FS from "fs";
import { sleep } from "./tools";

const USER_AGENT = "Mozilla/5.0 (Windows NT 6.3; Win64; x64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/67.0.3396.99 Safari/537.36";

const BOARD_URL_PREFIX = "http://huaban.com/boards/";

export interface ICategory {

    col: number;

    id: string;

    name: string;

    nav_link: string;
}

export interface ISettings {

    imgHosts: Record<string, string>;

    categories: ICategory[];
}

export interface IUserInfo {

    created_at: number;

    pin_count: number;

    user_id: number;

    username: number;
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

export interface IHuabanCrawler {

    getPinListOfBoard(
        id: number,
        firstPageOnly?: boolean,
        sleepPeriod?: number,
        sleepAccuracy?: number
    ): Promise<IBoardInfo>;

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

        if (ignoreIfDumpped && $FS.existsSync(imgPath)) {

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
            })
        });

        if (result.code !== 200) {

            throw result.data.length ?
                result.data.toString() :
                result;
        }

        $FS.writeFileSync(imgPath, result.data);

        if (metaPath) {

            $FS.writeFileSync(
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

    public async getPinListOfBoard(
        id: number,
        firstPageOnly: boolean = false,
        sleepPeriod: number = 0,
        sleepAccuracy: number = 0.5
    ): Promise<IBoardInfo> {

        const board = await this.getBoardInfo(id);

        if (firstPageOnly) {

            return board;
        }

        let minId = Math.min(...board.pins.map((x) => x.pin_id));

        while (1) {

            if (sleepPeriod) {

                await sleep(Math.floor(
                    sleepPeriod + sleepPeriod * (1 - sleepAccuracy) * Math.random()
                ));
            }

            let pagePins = await this.getPinListOfBoardAjax(
                id,
                minId
            );

            for (let pin of pagePins) {

                board.pins.push(pin);

                if (pin.pin_id < minId) {

                    minId = pin.pin_id;
                }
            }

            if (pagePins.length < 20) {

                break;
            }
        }

        return board;
    }

    private _updateSettings(html: string): void {

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

                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Referer": `${BOARD_URL_PREFIX}${id}/`
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

        this._updateSettings(html);

        const START_SIGN = 'app.page["board"] = ';

        const END_SIGN = "app._csr =";

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

        return JSON.parse(html.slice(startPos + START_SIGN.length, endPos));
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
