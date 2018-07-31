#!env node

// tslint:disable:no-console
import * as Huaban from "./libs/HuabanCrawler";
import * as Clap from "@litert/clap";
import * as $FS from "@litert/async-fs";
import { Async } from "@litert/core";
import * as NodePath from "path";

/**
 * How many pins per requests.
 */
const SLICE_SIZE = 20;

function parseCmdLineArgs(): Clap.IParseResult {

    const clap = Clap.createSimpleParser({
        follow: true,
        shortAttach: true,
        shortAssign: true,
        fullAssign: true
    });

    clap.addOption({
        name: "type",
        withArgument: true,
        shortcut: "t",
        description: "The type of resource to be crawled."
    }).addOption({
        name: "output",
        withArgument: true,
        shortcut: "o",
        description: "The path to be output."
    }).addOption({
        name: "board-id",
        shortcut: "b",
        withArgument: true,
        defaultArgument: "0",
        description: "The ID of board to be dumpped."
    }).addOption({
        name: "user-id",
        shortcut: "u",
        withArgument: true,
        defaultArgument: "0",
        description: "The ID of user to be dumpped."
    }).addOption({
        name: "user-name",
        shortcut: "U",
        withArgument: true,
        defaultArgument: "",
        description: "The name of user, in URL, to be dumpped."
    }).addOption({
        name: "gap",
        shortcut: "g",
        withArgument: true,
        defaultArgument: "0",
        description: "The gap of dump action, to simulate human operations."
    }).addOption({
        name: "accuracy",
        shortcut: "a",
        withArgument: true,
        defaultArgument: "1",
        description: "The accuracy of dump gap."
    }).addOption({
        name: "ignore-saved",
        shortcut: "i",
        description: "Ignore the already saved pins."
    }).addOption({
        name: "save-meta",
        shortcut: "m",
        description: "Save the meta of pins as JSON file named as pins' ID."
    });

    return clap.parse(process.argv.slice(2));
}

async function dumpPins(
    cli: Huaban.IHuabanCrawler,
    board: Huaban.IBoardInfo,
    pins: Huaban.IPinInfo[],
    i: number,
    sum: number,
    gap: number,
    accuracy: number,
    output: string,
    saveMeta: boolean,
    ignoreExists: boolean
): Promise<[number, number]> {

    for (let pin of pins) {

        i++;

        console.log(`[HBC][${i}/${board.pin_count}] Downloading pin ${pin.pin_id}...`);

        try {

            const resuLt = await cli.dumpFile(
                output,
                pin,
                saveMeta,
                ignoreExists
            );

            if (!resuLt.size) {

                console.log(
                    `[HBC][${i}/${board.pin_count}] Pin ${pin.pin_id} skipped.`
                );
                continue;
            }

            sum += resuLt.size;

            console.log(`[HBC][${i}/${board.pin_count}] Downloaded pin ${pin.pin_id}:`);
            console.log(`  Size:       ${resuLt.size} bytes`);
            console.log(`  Image File: ${resuLt.imgPath}`);

            if (resuLt.metaPath) {

                console.log(`  Meta File:  ${resuLt.metaPath}`);
            }

            console.log(`[HBC] Already download ${sum} bytes totally.`);
        }
        catch (e) {

            console.error(`Failed to save pin ${pin.pin_id}, error:`);
            console.error(e);
        }

        if (gap) {

            await Async.sleep(Math.floor(
                gap + gap * (1 - accuracy) * Math.random()
            ));
        }
    }

    return [i, sum];
}

function printBoardInfo(board: Huaban.IBoardInfo): void {

    console.log(`  ID:          ${board.board_id}`);
    console.log(`  Title:       ${board.title}`);
    console.log(`  Description: ${board.description}`);
    console.log(`  Pins:        ${board.pin_count}`);
    console.log(`  Followers:   ${board.follow_count}`);
    console.log(`  Category:    ${board.category_name} [${board.category_id}]`);
    console.log(`  Updated At:  ${new Date(board.updated_at * 1000)}`);
    console.log(`  Created At:  ${new Date(board.created_at * 1000)}`);
    console.log(`  User:`);
    console.log(`    ID:        ${board.user.user_id}`);
    console.log(`    Name:      ${board.user.username}`);
    console.log(`    Pins:      ${board.user.pin_count}`);
    console.log(`    Join At:   ${new Date(board.user.created_at * 1000)}`);
}

async function saveBoardInfo(
    board: Huaban.IBoardInfo,
    output: string
): Promise<void> {

    let data = JSON.parse(JSON.stringify(board));

    delete data.user.boards;
    delete data.pins;

    await $FS.writeFile(
        NodePath.resolve(output, "board.json"),
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

async function _dumpUser(
    cli: Huaban.IHuabanCrawler,
    username: string,
    output: string,
    gap: number,
    accuracy: number,
    ignoreSaved: boolean,
    saveMeta: boolean
): Promise<void> {

    console.log(`[HBC] Loading boards of user ${username}...`);

    let boards = await cli.getBoardsByUsername(
        username,
        gap,
        accuracy
    );

    console.log(`[HBC] ${boards.length} boards found.`);

    for (let board of boards) {

        const boardDir = NodePath.resolve(output, `${username}-${board.board_id}`);

        await _dumpBoard(
            cli,
            board,
            boardDir,
            gap,
            accuracy,
            ignoreSaved,
            saveMeta,
            true
        );
    }

    console.log(`[HBC] Completed.`);
}

async function dumpUser(
    args: Clap.IParseResult,
    output: string,
    gap: number,
    accuracy: number,
    ignoreSaved: boolean,
    saveMeta: boolean
): Promise<void> {

    const cli = Huaban.createCrawler();

    await cli.initialize();

    let uid!: number;

    let username: string;

    if (args.existOption("user-id")) {

        uid = parseInt(args.getOption("user-id"));

        const userInfo = await cli.getUserInfoByID(uid);

        username = userInfo.urlname;
    }
    else if (args.existOption("user-name")) {

        username = args.getOption("user-name");
    }
    else {

        throw new Error(
            "Must specify either --user-id or --user-name."
        );
    }

    await _dumpUser(
        cli,
        username,
        output,
        gap,
        accuracy,
        ignoreSaved,
        saveMeta
    );
}

async function dumpFollowedBoards(
    args: Clap.IParseResult,
    output: string,
    gap: number,
    accuracy: number,
    ignoreSaved: boolean,
    saveMeta: boolean
): Promise<void> {

    const cli = Huaban.createCrawler();

    await cli.initialize();

    let uid!: number;

    let username: string;

    if (args.existOption("user-id")) {

        uid = parseInt(args.getOption("user-id"));

        const userInfo = await cli.getUserInfoByID(uid);

        username = userInfo.urlname;
    }
    else if (args.existOption("user-name")) {

        username = args.getOption("user-name");
    }
    else {

        throw new Error(
            "Must specify either --user-id or --user-name."
        );
    }

    console.log(`[HBC] Loading user ${username} followed boards...`);

    let boards = await cli.getFollowedBoardsByUsername(
        username,
        gap,
        accuracy
    );

    console.log(`[HBC] ${boards.length} boards found.`);

    for (let board of boards) {

        const boardDir = NodePath.resolve(output, `${board.user.urlname}-${board.board_id}`);

        await _dumpBoard(
            cli,
            board,
            boardDir,
            gap,
            accuracy,
            ignoreSaved,
            saveMeta,
            true
        );
    }

    console.log(`[HBC] Completed.`);
}

async function dumpFollowedUsers(
    args: Clap.IParseResult,
    output: string,
    gap: number,
    accuracy: number,
    ignoreSaved: boolean,
    saveMeta: boolean
): Promise<void> {

    const cli = Huaban.createCrawler();

    await cli.initialize();

    let uid!: number;

    let username: string;

    if (args.existOption("user-id")) {

        uid = parseInt(args.getOption("user-id"));

        const userInfo = await cli.getUserInfoByID(uid);

        username = userInfo.urlname;
    }
    else if (args.existOption("user-name")) {

        username = args.getOption("user-name");
    }
    else {

        throw new Error(
            "Must specify either --user-id or --user-name."
        );
    }

    console.log(`[HBC] Loading user ${username} followed boards...`);

    let users = await cli.getFollowedUsersByUsername(
        username,
        gap,
        accuracy
    );

    console.log(`[HBC] ${users.length} users found.`);

    for (let user of users) {

        await _dumpUser(
            cli,
            user.urlname,
            output,
            gap,
            accuracy,
            ignoreSaved,
            saveMeta
        );
    }

    console.log(`[HBC] Completed.`);
}

async function _dumpBoard(
    cli: Huaban.IHuabanCrawler,
    bid: number | Huaban.IBoardInfo,
    output: string,
    gap: number,
    accuracy: number,
    ignoreSaved: boolean,
    saveMeta: boolean,
    forceReload: boolean = false
): Promise<void> {

    let sum: number = 0;

    let i: number = 0;

    console.info(`[HBC] Loading pins list in board page.`);

    let board = typeof bid === "number" ? await cli.getBoardInfo(bid) : bid;

    bid = board.board_id;

    console.log(`[HBC] Loaded details of board:`);

    printBoardInfo(board);

    try {

        await $FS.mkdirP(output);
    }
    catch {
        //
    }

    await saveBoardInfo(board, output);

    let dumpedFiles = await $FS.readdir(output);

    if (dumpedFiles.length - 1 === board.pin_count * 2) {

        console.log(`[HBC] The board has been dumped, skip.`);
        return;
    }

    let pins = board.pins;

    if (forceReload) {

        pins = await cli.getPinListOfBoardAjax(
            bid,
            0xFFFFFFFF,
            SLICE_SIZE
        );
    }

    do {

        if (gap) {

            await Async.sleep(Math.floor(
                gap + gap * (1 - accuracy) * Math.random()
            ));
        }

        [i, sum] = await dumpPins(
            cli,
            board,
            pins,
            i,
            sum,
            gap,
            accuracy,
            output,
            saveMeta,
            ignoreSaved
        );

        if (i === board.pin_count) {

            break;
        }

        const minPinId = Math.min(...pins.map((x) => x.pin_id));

        console.log(`[HBC] Scanning pins whose ID after ${minPinId}.`);

        pins = await cli.getPinListOfBoardAjax(
            bid,
            minPinId,
            SLICE_SIZE
        );

        if (pins.length === 0) {

            break;
        }

        console.log(`[HBC] Scanned ${pins.length} pins.`);
    }
    while (1);

    console.log(`[HBC] All pins in board ${bid} have been downloaded.`);
}

async function dumpBoard(
    args: Clap.IParseResult,
    output: string,
    gap: number,
    accuracy: number,
    ignoreSaved: boolean,
    saveMeta: boolean
): Promise<void> {

    const cli = Huaban.createCrawler();

    await cli.initialize();

    const bid = parseInt(args.getOption("board-id"));

    return _dumpBoard(
        cli,
        bid,
        output,
        gap,
        accuracy,
        ignoreSaved,
        saveMeta
    );
}

async function main() {

    const args = parseCmdLineArgs();

    const type = args.getOption("type");

    const output = args.getOption("output");

    const gap = args.getOption("gap") === undefined ?
        0 :
        parseInt(args.getOption("gap"));

    const accuracy = args.getOption("accuracy") === undefined ?
        1 :
        parseFloat(args.getOption("accuracy"));

    const ignoreSaved = args.existOption("ignore-saved");

    const saveMeta = args.existOption("save-meta");

    switch (type.toLowerCase()) {
    case "board":
        return await dumpBoard(
            args,
            output,
            gap,
            accuracy,
            ignoreSaved,
            saveMeta
        );
    case "user":
        return await dumpUser(
            args,
            output,
            gap,
            accuracy,
            ignoreSaved,
            saveMeta
        );
    case "followed-users":
        return await dumpFollowedUsers(
            args,
            output,
            gap,
            accuracy,
            ignoreSaved,
            saveMeta
        );
    case "followed-boards":
        return await dumpFollowedBoards(
            args,
            output,
            gap,
            accuracy,
            ignoreSaved,
            saveMeta
        );
    default:
        console.error(
            `Unknwon resource type "${type}" to be crawled.`
        );

        return;
    }

}

main().catch((e) => {

    console.error(e);
});
