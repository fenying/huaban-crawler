# Huaban-Crawler

> This project is just for studying, don't use it in any commercial activity.
>
> NO ANY COMMERCIAL USAGE GURANTEES.

This is a huaban-crawler base on Node.js.

Now this crawler can only download the images files from a determined board,
which is input from commandline.

## Usage

Clone this project and build it first.

```sh
git clone https://github.com/fenying/huaban-crawler.git
cd huaban-crawler
npm install
npm run rebuild
```

Now you can run it from command line:

> **For example, to download all images from board of ID 1234.**
> **And save the downloaded image files to folder `./pictures`.**

```sh
node dist/index.js \
    --board-id 1234
    --output ./pictures
    --gap 300
    --accuracy 0.4
    --ignore-saved
    --save-meta
```

Let me explain these options.

-   `--board-id <board-id>`

    **Required.**
    This option is used to specify the id of board to be downloaded.

-   `--output <output-dir>`

    **Required.**
    This option specifies the output directory of downloaded image files.

-   `--gap <interval>`

    **Optional.**
    This option enables and setup the interval of each download action, in 
    milliseconds, so that it can act like a real human-being. Because a human
    can not download/view the images so quickly.

    ***So it is strongly recommanded to enable this option.***

-   `--accuracy <random-factor>`

    **Optional.**
    This option specifies a random factor, and it adjust the gap to be
    `Math.floor(gap + gap * (1 - accuracy) * Math.random())`

    By default this option would be `1`, thus there is no random factor.

-   `--ignore-saved`

    **Optional.**
    This option prevents from downloading the downloaded pins.

-   `--save-meta`

    **Optional.**
    This option enables saving pins' metadata as a same-named json file like
    image files.

## LICENSE

This project is licensed by [MIT license](./LICENSE).
