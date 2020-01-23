# Polyfills

These libraries may make use of some features not found in older browsers, mainly fetch, Map, and Proxy. This primarily affects Internet Explorer 11, which requires that we provide this missing functionality. There are several ways to include this missing functionality.

> If you are supporting IE11 you should [enable IE11 mode](./ie11-mode.md), which will result in reduced functionality.

## IE 11 Polyfill package

We created a package you can use to include the needed functionality without having to determine what polyfills are required. Also, this package is independent of the other @pnp/* packages and does not need to be updated monthly unless we introduce additional polyfills and publish a new version. This package is only needed if you need to support IE 11.

### Install

`npm install @pnp/polyfill-ie11 --save`

### Use

```TypeScript
import "@pnp/polyfill-ie11";
import { sp } from "@pnp/sp/presets/all";

sp.web.lists.getByTitle("BigList").items.filter(`ID gt 6000`).get().then(r => {
  this.domElement.innerHTML += r.map(l => `${l.Title}<br />`);
});
```

### SearchQueryBuilder

Because the latest version of SearchQueryBuilder uses Proxy internally you can fall back on the older version for IE 11 as shown below.

```TypeScript
import "@pnp/polyfill-ie11";
import { SearchQueryBuilder } from "@pnp/polyfill-ie11/dist/searchquerybuilder";
import { sp, ISearchQueryBuilder } from "@pnp/sp/presets/all";

// works in IE11 and other browsers
const builder: ISearchQueryBuilder = SearchQueryBuilder().text("test");

sp.search(builder).then(r => {
  this.domElement.innerHTML = JSON.stringify(r);
});
```
