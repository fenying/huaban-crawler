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

// tslint:disable:no-console
import * as Huaban from "./libs/HuabanCrawler";
import * as Clap from "@litert/clap";
import { sleep } from "./libs/tools";

function parseCmdLineArgs(): Clap.IParseResult {

    const clap = Clap.createSimpleParser();

    clap.addOption({
        name: "output",
        withArgument: true,
        shortcut: "o",
        description: "The path to be output."
    }).addOption({
        name: "board-id",
        shortcut: "b",
        withArgument: true,
        description: "The ID of board to be dumpped."
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

            await sleep(Math.floor(
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

(async () => {

    const args = parseCmdLineArgs();

    const cli = Huaban.createCrawler();

    const bid = parseInt(args.getOption("board-id"));

    const output = args.getOption("output");

    const gap = args.getOption("gap") === undefined ?
        0 :
        parseInt(args.getOption("gap"));

    const accuracy = args.getOption("accuracy") === undefined ?
        1 :
        parseFloat(args.getOption("accuracy"));

    const ignoreSaved = args.existOption("ignore-saved");

    const saveMeta = args.existOption("save-meta");

    const SLICE_SIZE = 20;

    let sum: number = 0;

    let i: number = 0;

    console.info(`[HBC] Loading pins list in board page.`);

    let board = await cli.getBoardInfo(bid);

    console.log(`[HBC] Loaded details of board:`);

    printBoardInfo(board);

    let pins = board.pins;

    do {

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

        if (pins.length < SLICE_SIZE) {

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

        if (gap) {

            await sleep(Math.floor(
                gap + gap * (1 - accuracy) * Math.random()
            ));
        }

        console.log(`[HBC] Scanned ${pins.length} pins.`);
    }
    while (1);

    console.log(`[HBC] All pins in board ${bid} have been downloaded.`);

})().catch((e) => {

    console.error(e);
});
