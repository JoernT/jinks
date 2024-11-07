xquery version "3.1";

module namespace path="http://tei-publisher.com/jinks/path";

declare namespace repo="http://exist-db.org/xquery/repo";

declare function path:resolve-path($parent as xs:string?, $relPath as xs:string) as xs:string {
    replace(
        if (starts-with($relPath, "/db")) then
            $relPath
        else
            replace($parent || "/" || $relPath, "/{2,}", "/"),
        "/+$", 
        ""
    )
};

declare function path:parent($path as xs:string) {
    replace($path, "^(.*?)/[^/]+$", "$1")
};

declare function path:basename($path as xs:string) {
    replace($path, "^.*?/([^/]+)$", "$1")
};

declare function path:mkcol($context as map(*), $path as xs:string) {
    let $absPath := path:resolve-path($context?target, $path)
    let $nil :=
        path:mkcol(
            $absPath,
            ($context?pkg?user?name, $context?pkg?user?group), 
            $context?pkg?permissions
        )
    return
        ()
};

declare %private function path:mkcol-recursive($collection, $components, $userData as xs:string*, $permissions as xs:string?) {
    if (exists($components)) then
        let $permissions :=
            if ($permissions) then
                path:set-execute-bit($permissions)
            else
                "rwxr-x---"
        let $newColl := xs:anyURI(concat($collection, "/", $components[1]))
        return (
            if (not(xmldb:collection-available($newColl))) then
                xmldb:create-collection($collection, $components[1])
            else
                (),
            path:mkcol-recursive($newColl, subsequence($components, 2), $userData, $permissions)
        )
    else
        ()
};

declare %private function path:mkcol($path, $userData as xs:string*, $permissions as xs:string?) {
    let $path := if (starts-with($path, "/db/")) then substring-after($path, "/db/") else $path
    return
        path:mkcol-recursive("/db", tokenize($path, "/"), $userData, $permissions)
};

declare %private function path:set-execute-bit($permissions as xs:string) {
    replace($permissions, "(..).(..).(..).", "$1x$2x$3x")
};

declare function path:rmcol($context as map(*), $path as xs:string) {
    let $absPath := path:resolve-path($context?target, $path)
    return
        xmldb:remove($absPath)
};

declare function path:get-package-target($uri as xs:string?) {
    if (not(repo:list()[. = $uri])) then
        ()
    else
        let $repoXML := 
            repo:get-resource($uri, "repo.xml")
            => util:binary-to-string()
            => parse-xml()
        return
            if ($repoXML//repo:target) then
                repo:get-root() || $repoXML//repo:target
            else
                ()
};