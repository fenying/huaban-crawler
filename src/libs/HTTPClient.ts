/**
 *  Copyright 2018 Angus.Fenying <fenying@litert.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import * as URL from "url";
import * as NodeZLib from "zlib";
import * as NodeHTTP from "http";
import * as NodeHTTPS from "https";

export interface BasicAuthOptions {

    type: "basic";

    username: string;

    password: string;
}

export interface BearerAuthOptions {

    type: "bearer";

    token: string;
}

export interface URLInfo {

    host: string;

    path: string;

    port?: number;

    https?: boolean;
}

export interface IHttpRequestOptions {

    url: string | {

        host: string;

        path: string;

        port?: number;

        https?: boolean;
    };

    headers?: Record<string, string>;

    auth?: BasicAuthOptions | BearerAuthOptions;

    data?: Buffer | string;

    dataType?: string;

    headerOnly?: boolean;
}

export interface IHttpRequestDataOptions extends IHttpRequestOptions {

    data: Buffer | string;

    dataType: string;
}

export interface IFullHttpRequestOptions extends IHttpRequestOptions {

    "method": "GET" | "POST" | "PUT" | "PATCH" | "HEAD" | "DELETE" | "OPTIONS";
}

export interface IHttpResponse {

    code: number;

    data: Buffer;

    headers: Record<string, string | string[]>;
}

export interface IHttpClient {

    request(
        opt: IFullHttpRequestOptions
    ): Promise<IHttpResponse>;

    get(opts: IHttpRequestOptions): Promise<IHttpResponse>;

    post(opts: IHttpRequestDataOptions): Promise<IHttpResponse>;

    put(opts: IHttpRequestDataOptions): Promise<IHttpResponse>;

    delete(opts: IHttpRequestOptions): Promise<IHttpResponse>;

    patch(opts: IHttpRequestDataOptions): Promise<IHttpResponse>;

    head(opts: IHttpRequestOptions): Promise<Pick<IHttpResponse, "code" | "headers">>;

    options(opts: IHttpRequestOptions): Promise<IHttpResponse>;
}

class HttpClient
implements IHttpClient {

    public get(opts: IHttpRequestOptions): Promise<IHttpResponse> {

        const opt = <IFullHttpRequestOptions> opts;

        opt.method = "GET";

        return this.request(opt);
    }

    public delete(opts: IHttpRequestOptions): Promise<IHttpResponse> {

        const opt = <IFullHttpRequestOptions> opts;

        opt.method = "DELETE";

        return this.request(opt);
    }

    public options(opts: IHttpRequestOptions): Promise<IHttpResponse> {

        const opt = <IFullHttpRequestOptions> opts;

        opt.method = "OPTIONS";

        return this.request(opt);
    }

    public head(opts: IHttpRequestOptions): Promise<IHttpResponse> {

        const opt = <IFullHttpRequestOptions> opts;

        opt.method = "HEAD";
        opt.headerOnly = true;

        return this.request(opt);
    }

    public post(opts: IHttpRequestDataOptions): Promise<IHttpResponse> {

        const opt = <IFullHttpRequestOptions> opts;

        opt.method = "POST";

        return this.request(opt);
    }

    public patch(opts: IHttpRequestDataOptions): Promise<IHttpResponse> {

        const opt = <IFullHttpRequestOptions> opts;

        opt.method = "PATCH";

        return this.request(opt);
    }

    public put(opts: IHttpRequestDataOptions): Promise<IHttpResponse> {

        const opt = <IFullHttpRequestOptions> opts;

        opt.method = "PUT";

        return this.request(opt);
    }

    public request(
        opt: IFullHttpRequestOptions
    ): Promise<IHttpResponse> {

        let urlInfo: URLInfo;

        if (typeof opt.url === "string") {

            const url = URL.parse(opt.url);
            urlInfo = {
                host: url.hostname as string,
                path: url.path as string,
                port: url.port ? parseInt(url.port) : undefined,
                https: url.protocol === "https:"
            };
        }
        else {

            urlInfo = opt.url;
        }

        const cfg: any = {
            host: urlInfo.host,
            port: urlInfo.port,
            path: urlInfo.path,
            headers: opt.headers,
            secureProtocol: "TLSv1_2_method",
            method: opt.method
        };

        if (opt.method === "HEAD") {

            opt.headerOnly = true;
        }

        if (opt.dataType) {

            if (!cfg.headers) {

                cfg.headers = {};
            }

            cfg.headers["Content-Type"] = opt.dataType;
        }

        if (opt.auth) {

            if (!cfg.headers) {

                cfg.headers = {};
            }

            switch (opt.auth.type) {

            case "bearer":

                cfg.headers["Authorization"] = `Bearer ${opt.auth.token}`;
                break;

            case "basic":

                cfg.headers["Authorization"] = `Basic ${Buffer.from(
                    `${opt.auth.username}:${opt.auth.password}`
                ).toString("base64")}`;
                break;
            }
        }

        if (opt.data) {

            if (!cfg.headers) {

                cfg.headers = {};
            }

            cfg.headers["Content-Length"] = Buffer.byteLength(opt.data);
        }

        return new Promise<IHttpResponse>(function(resolve, reject): void {

            const callback = function(resp: NodeHTTP.IncomingMessage): void {

                if (
                    opt.headerOnly ||
                    resp.statusCode === 204 ||
                    !resp.headers["content-type"]
                ) {

                    resp.destroy();

                    return resolve({
                        code: resp.statusCode as number,
                        data: Buffer.alloc(0),
                        headers: <any> resp.headers
                    });
                }

                const dataBuf: Buffer[] = [];

                let stream: any = resp;

                if (resp.headers["content-encoding"] === "gzip") {

                    stream = NodeZLib.createGunzip();
                    resp.pipe(stream);
                }
                else if (resp.headers["content-encoding"] === "deflate") {

                    stream = NodeZLib.createDeflate();
                    resp.pipe(stream);
                }

                stream.on("data", function(chunk: Buffer): void {

                    dataBuf.push(chunk);

                }).on("end", function(): void {

                    resp.destroy();

                    return resolve({
                        code: resp.statusCode as number,
                        data: Buffer.concat(dataBuf),
                        headers: <any> resp.headers
                    });
                });
            };

            const req = urlInfo.https ?
                NodeHTTPS.request(cfg, callback) :
                NodeHTTP.request(cfg, callback);

            req.once("error", (e) => {

                // tslint:disable-next-line:no-console
                console.error(e);
                reject(e);
            });

            if (opt.data) {

                req.end(Buffer.from(opt.data as string));
            }
            else {

                req.end();
            }
        });
    }
}

export function createClient(): IHttpClient {

    return new HttpClient();
}
