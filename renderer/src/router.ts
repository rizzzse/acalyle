type TypeFlat<T> = T extends unknown ? { [P in keyof T]: T[P] } : never;

type RemoveHead<S extends string, Head extends string> = S extends `${Head}${infer P}` ? P : S;
type RemoveTail<S extends string, Tail extends string> = S extends `${infer P}${Tail}` ? P : S;

type Mark = "+" | "*" | "?";

export type MatchParams<T extends string> = {
    [P in T as RemoveTail<P, Mark>]:
        P extends `${string}+` ? [string, ...string[]]
        : P extends `${string}*` ? string[]
        : P extends `${string}?` ? string | undefined
        : string;
};

type ParamKey<T extends string> = T extends `:${infer U}` ? U : never;

export type ParseStringPath<T extends string> = T extends `${infer U}/${infer Rest}`
    ? ParamKey<U> | ParseStringPath<Rest>
    : ParamKey<T>;

type Part = string | { key: string, mark: Mark | "" }

const parsePatternPart = (part: string): Part => {
    const match = /^:(\w*)([+*?]?)/.exec(part);
    return match == null ? part
        : { key: match[1], mark: match[2] as Mark | "" };
};

const parsePattern = (pattern: string): Part[] =>
    pattern.split("/").filter(Boolean).map(parsePatternPart);

export type Link<T extends string = string> = string & { "__?link": T };

export interface LinkCtor<T extends string> {
    <U extends T>(pattern: U, params: MatchParams<ParseStringPath<U>>): Link<U>;
    <U extends T>(
        pattern: U,
        ...args: U extends `${string}/:${string}` | `:${string}`
            ? [params: MatchParams<ParseStringPath<U>>] : []
    ): Link<U>;
}

type RouteEntries<T extends string, ParamKeys extends string, R> = {
    [P in T as RemoveTail<P, `/${string}`>]: (
        Route<
            P extends `${string}/${infer P}` ? P : "",
            (P extends `:${infer P}` ? RemoveTail<P, `/${string}`> : never) | ParamKeys,
            R
        >
    );
};

export class Route<Path extends string, ParamKeys extends string, R = unknown> {
    private routes: { part: Part, route: Route<string, string, R> }[];
    protected constructor(routes: object) {
        this.routes = Object.keys(routes).map(key => {
            const pattern = parsePattern(key);
            return {
                part: pattern.shift() ?? "",
                route: pattern.reduceRight<Route<string, string, R>>(
                    (accum, part) => new Route({
                        [typeof part === "string" ? part : ":" + part.key + part.mark]: accum,
                    }),
                    routes[key as keyof typeof routes],
                ),
            };
        });
    }
    protected get(path: string[], matchParams: MatchParams<ParamKeys>): R | null {
        for(const { part, route } of this.routes) {
            const path$ = [...path];
            const matchParams$ = { ...matchParams };
            if(typeof part === "string") {
                if(part !== "" && path$.shift() !== part) {
                    continue;
                }
            } else {
                if((part.mark === "+" || part.mark === "") && path$.length === 0) {
                    continue;
                }
                matchParams$[part.key as never] = part.mark === "+" || part.mark === "*"
                    ? path$ as never : path$.shift() as never;
            }
            const result = route.get(path$, matchParams$);
            if(result !== null) {
                return result;
            }
        }
        return null;
    }
    match(
        link: Link<Path>,
        ...args: [ParamKeys] extends [never]
            ? [] : [matchParams: MatchParams<ParamKeys>]
    ): R | null;
    match(link: Link<Path>, matchParams?: MatchParams<ParamKeys>): R | null {
        const path = link.split("/");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.get(path, matchParams!);
    }
    static link<T extends Routing<string, string>>(): LinkCtor<PathNomalize<T["path"]>> {
        return <U extends string>(pattern: U, params?: MatchParams<ParseStringPath<U>>) =>
            parsePattern(pattern).flatMap(part => {
                if(typeof part === "string") {
                    return part;
                }
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const param = params![part.key as keyof typeof params] as string[] | string | undefined;
                return part.mark === "?" && param === undefined ? [] : param;
            }).join("/") as Link<never>;
    }
    static routes<T extends string, ParamKeys extends string, R>(
        routes: TypeFlat<RouteEntries<T, ParamKeys, R>>,
    ): Route<T, ParamKeys, R>;
    static routes<T extends Routing<string, string>, R>(
        routes: TypeFlat<RouteEntries<T["path"], T["paramKeys"], R>>,
    ): Route<T["path"], T["paramKeys"], R>;
    static routes<T extends string, ParamKeys extends string, R>(
        routes: TypeFlat<RouteEntries<T, ParamKeys, R>>,
    ): Route<T, ParamKeys, R> {
        return new Route(routes);
    }
    static page<ParamKeys extends string, R>(
        page: (params: MatchParams<ParamKeys>) => R,
    ): Page<ParamKeys, R> {
        return new Page(page);
    }
}

class Page<ParamKeys extends string, R> extends Route<"", ParamKeys, R> {
    constructor(private readonly route: (params: MatchParams<ParamKeys>) => R) {
        super({});
    }
    protected override get(path: string[], matchParams: MatchParams<ParamKeys>): R | null {
        if(path.length !== 0) {
            return null;
        }
        return this.route(matchParams);
    }
}

export type PathNomalize<T extends string> =
    T extends `${infer Pre}//${infer Post}` ? PathNomalize<`${Pre}/${Post}`>
    : T extends `/${infer U}` | `${infer U}/` ? PathNomalize<U>
    : T;

export interface Routing<Path extends string, ParamKeys extends string = never> {
    path: Path;
    paramKeys: ParamKeys;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace Route {
    type NestRoutes<
        T extends Record<string, Routing<string, string>>,
        K extends keyof T,
    > = Routing<
        PathNomalize<
            K extends "" ? T[K]["path"]
            : K extends string ? `${K}/${T[K]["path"]}`
            : never
        >,
        K extends string
            ? T[K] extends Routing<string, infer ParamKeys>
                ? Exclude<ParamKeys, RemoveHead<K, ":">>
                : never
            : never
    >;
    export type Routes<T extends Record<string, Routing<string, string>>> = NestRoutes<T, Extract<keyof T, string>>;
    export type Page<ParamKeys extends string = never> = Routing<"", ParamKeys>;
}

if(import.meta.vitest) {
    const { it, expect } = import.meta.vitest;
    const link = Route.link();
    it("link", () => {
        expect(link("")).toBe("");
        expect(link("hoge")).toBe("hoge");
        expect(link("/a///b")).toBe("a/b");
        expect(link("normal/://:option?/:many*/", {
            "": "any",
            option: undefined,
            many: ["a", "b"],
        })).toBe("normal/any/a/b");
    });
    it("constructor", () => {
        expect(Route.routes({})).toEqual({ routes: [] });
        expect(Route.routes({
            hoge: parsePattern as never,
            ":fuga": parsePattern as never,
            "piyo/piyoyo": parsePattern as never,
        })).toEqual({
            routes: [
                { part: "hoge", route: parsePattern },
                { part: parsePatternPart(":fuga"), route: parsePattern },
                {
                    part: "piyo",
                    route: {
                        routes: [{ part: "piyoyo", route: parsePattern }]
                    },
                },
            ],
        });
    });
    it("match path", () => {
        type P = Routing<string, never>;
        type R = MatchParams<never>;
        const page = Route.page<never, R>(params => params);
        expect(page.match(link(""))).toEqual({});
        expect(Route.routes<P, R>({ "": page }).match(link(""))).toEqual({});
        expect(Route.routes<P, R>({ hoge: page }).match(link("hoge"))).toEqual({});
    });
}
