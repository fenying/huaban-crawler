# Huaban-Crawler

> This project is just for studying, don't use it in any commercial activity.
>
> NO ANY COMMERCIAL USAGE GURANTEES.

This is a huaban-crawler base on Node.js.

You can use this crawler to download the pins belong to:

- a board,
- the boards of a user
- the boards of the users followed by a user
- the boards followed by a user.

## Usage

Clone this project and build it first.

```sh
git clone https://github.com/fenying/huaban-crawler.git
cd huaban-crawler
npm install
npm run rebuild
```

### Example-1: Dump a board

Run it from command line:

> **For example, to download all images from board of ID 1234.**
> **And save the downloaded image files to folder `./pictures`.**

```sh
node dist/index.js \
    > --type=board \
    > --board-id=1234 \
    > --output=./pictures \
    > --gap=300 \
    > --accuracy=0.4 \
    > --ignore-saved \
    > --save-meta
```

or use the shortcut options form:

```sh
node dist/index.js \
    > -t=board \
    > -b=1234 \
    > -o=./pictures \
    > -g=300 \
    > -a=0.4 \
    > -im
```

### Example-2: Dump all boards belong to a user

Run it from command line:

> **For example, to download all pins in boards belong to the user of ID 1234.**
> **And the pins in every boards will be save into folder like**
> **path `./dump/<username>-<board-id>`.**

```sh
node dist/index.js \
    > --type=user \
    > --user-id=1234 \
    > --output=./dump \
    > --gap=300 \
    > --accuracy=0.4 \
    > --ignore-saved \
    > --save-meta
```

> And also you can use `--user-name` instead of `--user-id`.
> For more details, see the options descriptions below.

### Example-3: Dump all boards belong to users followed by a user

Run it from command line:

> **For example, to download all pins in boards belong to users followed by**
> **the user of ID 1234.**
> **And the pins in every boards will be save into folder like**
> **path `./dump/<username>-<board-id>`.**

```sh
node dist/index.js \
    > --type=followed-users \
    > --user-id=1234 \
    > --output=./dump \
    > --gap=300 \
    > --accuracy=0.4 \
    > --ignore-saved \
    > --save-meta
```

> And also you can use `--user-name` instead of `--user-id`.
> For more details, see the options descriptions below.

### Example-4: Dump all boards followed by a user

Run it from command line:

> **For example, to download all pins in boards followed by the user of ID**
> **1234.**
> **And the pins in every boards will be save into folder like**
> **path `./dump/<username>-<board-id>`.**

```sh
node dist/index.js \
    > --type=followed-users \
    > --user-id=1234 \
    > --output=./dump \
    > --gap=300 \
    > --accuracy=0.4 \
    > --ignore-saved \
    > --save-meta
```

> And also you can use `--user-name` instead of `--user-id`.
> For more details, see the options descriptions below.

## Command-Line Options

Let's see these options.

-   `--type=<type>` or `-t=<type>`

    > **Required.**
    > This option specifies what type of resource to be crawled.
    > Following values are allowed:
    >
    > - `board` (must work with `--board-id`)
    > - `user` (must work with `--user-id` or `--user-name`)
    > - `followed-users` (must work with `--user-id` or `--user-name`)
    > - `followed-boards` (must work with `--user-id` or `--user-name`)

-   `--output <output-dir>` or `-o <output-dir>`

    > **Required.**
    > This option specifies the output directory of downloaded image files.

-   `--board-id=<board-id>` or `-b=<board-id>`

    > **Optional.**
    > This option is used to specify the id of board to be downloaded.
    >
    > > Must set when `--type board` is used.

-   `--user-id <user-id>` or `-u <user-id>`

    > **Optional.**
    > This option is used to specify the name of user **in URL**.

    > > Must set when `--type` is `user`, `followed-users` or `followed-boards`.

-   `--user-name=<user-name>` or `-U=<user-name>`

    > **Optional.**
    > This option is used to specify the name of user.
    >
    > ***e.g. Like `http://huaban.com/abc/`, the word `abc` is the name.***
    >
    > > Must set when `--type` is `user`, `followed-users` or `followed-boards`.

-   `--gap=<interval>` or `-g=<interval>`

    > **Optional.**
    > This option enables and setup the interval of each download action, in 
    > milliseconds, so that it can act like a real human-being. Because a human
    > can not download/view the images so quickly.
    >
    > ***So it is strongly recommanded to enable this option.***

-   `--accuracy=<random-factor>` or `-a=<random-factor>`

    > **Optional.**
    > This option specifies a random factor, and it adjust the gap to be
    > `Math.floor(gap + gap * (1 - accuracy) * Math.random())`
    >
    > By default this option would be `1`, thus there is no random factor.

-   `--ignore-saved` or `-i`

    > **Optional.**
    > This option prevents from downloading the downloaded pins.

-   `--save-meta` or `-m`

    > **Optional.**
    > This option enables saving pins' metadata as a same-named json file like
    > image files.

## LICENSE

This project is licensed by [MIT license](./LICENSE).
