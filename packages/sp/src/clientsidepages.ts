import { File } from "./files";
import { Item, ItemUpdateResult } from "./items";
import { TypedHash, extend, getGUID, jsS, hOP, stringIsNullOrEmpty } from "@pnp/common";
import { SharePointQueryable } from "./sharepointqueryable";
import { metadata } from "./utils/metadata";
import { List } from "./lists";
import { odataUrlFrom } from "./odata";

/**
 * Page promotion state
 */
export const enum PromotedState {
    /**
     * Regular client side page
     */
    NotPromoted = 0,
    /**
     * Page that will be promoted as news article after publishing
     */
    PromoteOnPublish = 1,
    /**
     * Page that is promoted as news article
     */
    Promoted = 2,
}

/**
 * Type describing the available page layout types for client side "modern" pages
 */
export type ClientSidePageLayoutType = "Article" | "Home";

/**
 * Column size factor. Max value is 12 (= one column), other options are 8,6,4 or 0
 */
export type CanvasColumnFactor = 0 | 2 | 4 | 6 | 8 | 12;

/**
 * Gets the next order value 1 based for the provided collection
 * 
 * @param collection Collection of orderable things
 */
function getNextOrder(collection: { order: number }[]): number {

    if (collection.length < 1) {
        return 1;
    }

    return Math.max.apply(null, collection.map(i => i.order)) + 1;
}

/**
 * Normalizes the order value for all the sections, columns, and controls to be 1 based and stepped (1, 2, 3...)
 * 
 * @param collection The collection to normalize
 */
function reindex(collection: { order: number, columns?: { order: number }[], controls?: { order: number }[] }[]): void {

    for (let i = 0; i < collection.length; i++) {
        collection[i].order = i + 1;
        if (hOP(collection[i], "columns")) {
            reindex(collection[i].columns);
        } else if (hOP(collection[i], "controls")) {
            reindex(collection[i].controls);
        }
    }
}

/**
 * Represents the data and methods associated with client side "modern" pages
 */
export class ClientSidePage extends SharePointQueryable {

    private _pageSettings: IClientSidePageSettingsSlice;
    private _layoutPart: ILayoutPartsContent;

    /**
     * PLEASE DON'T USE THIS CONSTRUCTOR DIRECTLY
     * 
     * @param baseUrl 
     * @param json 
     * @param commentsDisabled 
     * @param sections 
     */
    constructor(baseUrl: string | SharePointQueryable, private json?: Partial<IPageData>, noInit = false, public sections: CanvasSection[] = [], public commentsDisabled = false) {
        super(baseUrl);

        // set a default page settings slice
        this._pageSettings = { controlType: 0, pageSettingsSlice: { isDefaultDescription: true, isDefaultThumbnail: true } };

        // set a default layout part
        this._layoutPart = ClientSidePage.getDefaultLayoutPart();

        if (typeof json !== "undefined" && !noInit) {
            this.fromJSON(json);
        }
    }

    /**
     * Creates a new blank page within the supplied library [does not work with batching]
     * 
     * @param library NOT NEEDED, you can pass null
     * @param pageName Filename of the page, such as "page"
     * @param title The display title of the page
     * @param pageLayoutType Layout type of the page to use
     */
    public static async create(_library: any = null, pageName: string, title: string, pageLayoutType: ClientSidePageLayoutType = "Article"): Promise<ClientSidePage> {

        // patched because previously we used the full page name with the .aspx at the end
        // this allows folk's existing code to work after the re-write to the new API
        pageName = pageName.replace(/\.aspx$/i, "");

        // this is the user data we will use to init the author field
        // const currentUserLogin = await ClientSidePage.getPoster("/_api/web/currentuser").select("UserPrincipalName").get<{ UserPrincipalName: string }>();

        // initialize the page, at this point a checked-out page with a junk filename will be created.
        const pageInitData = await ClientSidePage.getPoster("_api/sitepages/pages").postCore<IPageData>({
            body: jsS(Object.assign(metadata("SP.Publishing.SitePage"), {
                PageLayoutType: pageLayoutType,
            })),
        });

        // now we can init our page with the save data
        const newPage = new ClientSidePage("", pageInitData);
        // newPage.authors = [currentUserLogin.UserPrincipalName];
        newPage.title = pageName;
        await newPage.save(false);
        newPage.title = title;
        return newPage;
    }

    /**
     * Creates a new ClientSidePage instance from the provided html content string
     * 
     * @param html HTML markup representing the page
     */
    public static fromFile(file: File): Promise<ClientSidePage> {

        return file.getItem<{ Id: number }>().then(i => {
            const page = new ClientSidePage(file, { Id: i.Id }, true);
            return page.load();
        });
    }

    private static getDefaultLayoutPart(): ILayoutPartsContent {
        const layoutId = getGUID();
        return {
            dataVersion: "1.4",
            description: "Title Region Description",
            id: layoutId,
            instanceId: layoutId,
            properties: {
                authorByline: [],
                authors: [],
                layoutType: "FullWidthImage",
                showPublishDate: false,
                showTopicHeader: false,
                textAlignment: "Left",
                title: "",
                topicHeader: "",
            },
            serverProcessedContent: { htmlStrings: {}, searchablePlainTexts: {}, imageSources: {}, links: {} },
            title: "Title area",
        };
    }

    private static getPoster(url: string): ClientSidePage {
        return new ClientSidePage(url);
    }

    public get pageLayout(): ClientSidePageLayoutType {
        return this.json.PageLayoutType;
    }

    public set pageLayout(value: ClientSidePageLayoutType) {
        this.json.PageLayoutType = value;
    }

    public get bannerImageUrl(): string {
        return this.json.BannerImageUrl;
    }

    public set bannerImageUrl(value: string) {
        this.json.BannerImageUrl = value;
    }

    public get bannerImageSourceType(): number {
        return this._layoutPart.properties.imageSourceType;
    }

    public set bannerImageSourceType(value: number) {
        this._layoutPart.properties.imageSourceType = value;
    }

    public get topicHeader(): string {
        return this.json.TopicHeader;
    }

    public set topicHeader(value: string) {
        this.json.TopicHeader = value;
        this._layoutPart.properties.topicHeader = value;
        if (stringIsNullOrEmpty(value)) {
            this.showTopicHeader = false;
        }
    }

    public get authors(): string[] {
        return this._layoutPart.properties.authorByline;
    }

    public set authors(value: string[]) {
        this.json.AuthorByline = value;
        this._layoutPart.properties.authorByline = value;
        this._layoutPart.properties.authors = null;
    }

    public get title(): string {
        return this._layoutPart.properties.title;
    }

    public set title(value: string) {
        this.json.Title = value;
        this._layoutPart.properties.title = value;
    }

    public get layoutType(): LayoutType {
        return this._layoutPart.properties.layoutType;
    }

    public set layoutType(value: LayoutType) {
        this._layoutPart.properties.layoutType = value;
    }

    public get headerTextAlignment(): TextAlignment {
        return this._layoutPart.properties.textAlignment;
    }

    public set headerTextAlignment(value: TextAlignment) {
        this._layoutPart.properties.textAlignment = value;
    }

    public get showTopicHeader(): boolean {
        return this._layoutPart.properties.showTopicHeader;
    }

    public set showTopicHeader(value: boolean) {
        this._layoutPart.properties.showTopicHeader = value;
    }

    public get showPublishDate(): boolean {
        return this._layoutPart.properties.showPublishDate;
    }

    public set showPublishDate(value: boolean) {
        this._layoutPart.properties.showPublishDate = value;
    }

    /**
     * Add a section to this page
     */
    public addSection(): CanvasSection {
        const section = new CanvasSection(this, getNextOrder(this.sections));
        this.sections.push(section);
        return section;
    }

    public fromJSON(pageData: Partial<IPageData>): this {

        this.json = pageData;

        const canvasControls: IClientSideControlBaseData[] = JSON.parse(pageData.CanvasContent1);

        const layouts = <ILayoutPartsContent[]>JSON.parse(pageData.LayoutWebpartsContent);
        if (layouts && layouts.length > 0) {
            this._layoutPart = layouts[0];
        }

        if (canvasControls && canvasControls.length) {

            for (let i = 0; i < canvasControls.length; i++) {

                // if no control type is present this is a column which we give type 0 to let us process it
                const controlType = hOP(canvasControls[i], "controlType") ? canvasControls[i].controlType : 0;

                switch (controlType) {

                    case 0:
                        // empty canvas column or page settings
                        if (hOP(canvasControls[i], "pageSettingsSlice")) {
                            this._pageSettings = <IClientSidePageSettingsSlice>canvasControls[i];
                        } else {
                            // we have an empty column
                            this.mergeColumnToTree(new CanvasColumn(<IClientSidePageColumnData>canvasControls[i]));
                        }
                        break;
                    case 3:
                        const part = new ClientSideWebpart(<IClientSideWebPartData>canvasControls[i]);
                        this.mergePartToTree(part, part.data.position);
                        break;
                    case 4:
                        const textData = <IClientSideTextData>canvasControls[i];
                        const text = new ClientSideText(textData.innerHTML, textData);
                        this.mergePartToTree(text, text.data.position);
                        break;
                }
            }
        }

        return this;
    }

    /**
     * Loads this page's content from the server
     */
    public load(): Promise<ClientSidePage> {

        // load item id, then load page data from new pages api
        return this.getItem<{ Id: number, CommentsDisabled: boolean }>("Id", "CommentsDisabled").then(item => {
            return (new SharePointQueryable(`_api/sitepages/pages(${item.Id})`)).get<IPageData>().then(pageData => {
                this.commentsDisabled = item.CommentsDisabled;
                return this.fromJSON(pageData);
            });
        });
    }

    /**
     * Persists the content changes (sections, columns, and controls) [does not work with batching]
     * 
     * @param publish If true the page is published, if false the changes are persisted to SharePoint but not published
     */
    public save(publish = true): Promise<boolean> {

        if (this.json.Id === null) {
            throw Error("The id for this page is null. If you want to create a new page, please use ClientSidePage.Create");
        }

        // we will chain our work on this promise
        let promise = Promise.resolve<any>({});

        // we need to update our authors if they have changed
        // if (this._layoutPart.properties.authors === null && this._layoutPart.properties.authorByline.length > 0) {

        //     promise = promise.then(_ => new Promise(resolve => {

        //         const collector: any[] = [];
        //         const userResolver = ClientSidePage.getPoster("/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.ClientPeoplePickerResolveUser");

        //         this._layoutPart.properties.authorByline.forEach(async author => {
        //             const userData = await userResolver.postCore({
        //                 body: jsS({
        //                     queryParams: {
        //                         AllowEmailAddresses: false,
        //                         MaximumEntitySuggestions: 1,
        //                         PrincipalSource: 15,
        //                         PrincipalType: 1,
        //                         QueryString: author,
        //                         SharePointGroupID: 0,
        //                     },
        //                 }),
        //             });

        //             collector.push({
        //                 email: userData.EntityData.Email,
        //                 id: userData.Key,
        //                 name: userData.DisplayName,
        //                 role: "",
        //                 upn: userData.EntityData.Email,
        //             });
        //         });

        //         this._layoutPart.properties.authors = collector;

        //         resolve();
        //     }));
        // }

        // we try and check out the page for the user
        if (!this.json.IsPageCheckedOutToCurrentUser) {
            promise = promise.then(_ => (ClientSidePage.getPoster(`_api/sitepages/pages(${this.json.Id})/checkoutpage`)).postCore<IPageData>());
        }

        promise = promise.then(_ => (ClientSidePage.getPoster(`_api/sitepages/pages(${this.json.Id})/savepage`)).postCore<boolean>({
            body: jsS(Object.assign(metadata("SP.Publishing.SitePage"), {
                AuthorByline: this.json.AuthorByline,
                BannerImageUrl: this.json.BannerImageUrl,
                CanvasContent1: this.getCancasContent1(),
                LayoutWebpartsContent: this.getLayoutWebpartsContent(),
                Title: this.json.Title,
                TopicHeader: this.json.TopicHeader,
            })),
        }));

        if (publish) {
            promise = promise.then(_ => (ClientSidePage.getPoster(`_api/sitepages/pages(${this.json.Id})/publish`)).postCore<boolean>());
        }

        return promise;
    }

    public discardPageCheckout(): Promise<void> {

        if (this.json.Id === null) {
            throw Error("The id for this page is null. If you want to create a new page, please use ClientSidePage.Create");
        }

        return ClientSidePage.getPoster(`_api/sitepages/pages(${this.json.Id})/discardPage`).postCore<IPageData>({
            body: jsS(metadata("SP.Publishing.SitePage")),
        }).then(d => {
            this.fromJSON(d);
        });
    }

    /**
     * Enables comments on this page
     */
    public enableComments(): Promise<ItemUpdateResult> {
        return this.setCommentsOn(true).then(r => {
            this.commentsDisabled = false;
            return r;
        });
    }

    /**
     * Disables comments on this page
     */
    public disableComments(): Promise<ItemUpdateResult> {
        return this.setCommentsOn(false).then(r => {
            this.commentsDisabled = true;
            return r;
        });
    }

    /**
     * Finds a control by the specified instance id
     *
     * @param id Instance id of the control to find
     */
    public findControlById<T extends ColumnControl<any> = ColumnControl<any>>(id: string): T {
        return this.findControl((c) => c.id === id);
    }

    /**
     * Finds a control within this page's control tree using the supplied predicate
     *
     * @param predicate Takes a control and returns true or false, if true that control is returned by findControl
     */
    public findControl<T extends ColumnControl<any> = ColumnControl<any>>(predicate: (c: ColumnControl<any>) => boolean): T {
        // check all sections
        for (let i = 0; i < this.sections.length; i++) {
            // check all columns
            for (let j = 0; j < this.sections[i].columns.length; j++) {
                // check all controls
                for (let k = 0; k < this.sections[i].columns[j].controls.length; k++) {
                    // check to see if the predicate likes this control
                    if (predicate(this.sections[i].columns[j].controls[k])) {
                        return <T>this.sections[i].columns[j].controls[k];
                    }
                }
            }
        }

        // we found nothing so give nothing back
        return null;
    }

    /**
     * Like the modern site page
     */
    public like(): Promise<void> {
        return this.getItem().then(i => {
            return i.like();
        });
    }

    /**
     * Unlike the modern site page
     */
    public unlike(): Promise<void> {
        return this.getItem().then(i => {
            return i.unlike();
        });
    }

    /**
     * Get the liked by information for a modern site page     
     */
    public getLikedByInformation(): Promise<any> {
        return this.getItem().then(i => {
            return i.getLikedByInformation();
        });
    }

    protected getCancasContent1(): string {

        // reindex things
        reindex(this.sections);

        // rollup the control changes
        const canvasData: any[] = [];

        this.sections.forEach(section => {
            section.columns.forEach(column => {
                if (column.controls.length < 1) {
                    canvasData.push({
                        displayMode: column.data.displayMode,
                        emphasis: column.data.emphasis,
                        position: column.data.position,
                    });
                } else {
                    column.controls.forEach(control => canvasData.push(control.data));
                }
            });
        });

        canvasData.push(this._pageSettings);
        return JSON.stringify(canvasData);
    }

    protected getLayoutWebpartsContent(): string {
        if (this._layoutPart) {
            return JSON.stringify([this._layoutPart]);
        } else {
            return JSON.stringify(null);
        }
    }

    /**
     * Sets the comments flag for a page
     * 
     * @param on If true comments are enabled, false they are disabled
     */
    private setCommentsOn(on: boolean): Promise<ItemUpdateResult> {
        return this.getItem().then(i => {
            const updater = new Item(i, `SetCommentsDisabled(${!on})`);
            return updater.update({});
        });
    }

    /**
     * Merges the control into the tree of sections and columns for this page
     * 
     * @param control The control to merge
     */
    private mergePartToTree(control: any, positionData: IClientSideControlPositionData): void {

        let section: CanvasSection = null;
        let column: CanvasColumn = null;
        let sectionFactor: CanvasColumnFactor = 12;
        let sectionIndex = 0;
        let zoneIndex = 0;

        // handle case where we don't have position data (shouldn't happen?)
        if (positionData) {
            if (hOP(positionData, "zoneIndex")) {
                zoneIndex = positionData.zoneIndex;
            }
            if (hOP(positionData, "sectionIndex")) {
                sectionIndex = positionData.sectionIndex;
            }
            if (hOP(positionData, "sectionFactor")) {
                sectionFactor = positionData.sectionFactor;
            }
        }

        const sections = this.sections.filter(s => s.order === zoneIndex);
        if (sections.length < 1) {
            section = new CanvasSection(this, zoneIndex);
            this.sections.push(section);
        } else {
            section = sections[0];
        }

        const columns = section.columns.filter(c => c.order === sectionIndex);
        if (columns.length < 1) {
            // create empty column
            column = new CanvasColumn();
            column.order = sectionIndex;
            column.factor = sectionFactor;
            section.columns.push(column);
        } else {
            column = columns[0];
        }

        control.column = column;
        column.addControl(control);
    }

    /**
     * Merges the supplied column into the tree
     * 
     * @param column Column to merge
     * @param position The position data for the column
     */
    private mergeColumnToTree(column: CanvasColumn): void {

        const order = hOP(column.data, "position") && hOP(column.data.position, "zoneIndex") ? column.data.position.zoneIndex : 0;
        let section: CanvasSection = null;
        const sections = this.sections.filter(s => s.order === order);

        if (sections.length < 1) {
            section = new CanvasSection(this, order);
            this.sections.push(section);
        } else {
            section = sections[0];
        }

        column.section = section;
        section.columns.push(column);
    }

    private getItem<T>(...selects: string[]): Promise<Item & T> {

        const initer = ClientSidePage.getPoster("/_api/lists/EnsureClientRenderedSitePagesLibrary").select("EnableModeration", "EnableMinorVersions", "Id");
        return initer.postCore<{ Id: string, "odata.id": string }>().then(listData => {
            const item = (new List(listData["odata.id"])).items.getById(this.json.Id);

            return item.select.apply(item, selects).get().then((d: T) => {
                return extend(new Item(odataUrlFrom(d)), d);
            });
        });
    }
}

export abstract class CanvasControl<PayloadType extends ICanvasControlBaseData> {

    constructor(protected json: PayloadType) { }

    public get id(): string {
        return this.json.id;
    }

    public get data(): PayloadType {
        return this.json;
    }

    protected setData(data: PayloadType) {
        this.json = data;
    }
}

export class CanvasSection {

    /**
     * Used to track this object inside the collection at runtime
     */
    private _memId: string;

    constructor(public page: ClientSidePage, public order: number, public columns: CanvasColumn[] = []) {
        this._memId = getGUID();
    }

    /**
     * Default column (this.columns[0]) for this section
     */
    public get defaultColumn(): CanvasColumn {

        if (this.columns.length < 1) {
            this.addColumn(12);
        }

        return this.columns[0];
    }

    /**
     * Adds a new column to this section
     */
    public addColumn(factor: CanvasColumnFactor): CanvasColumn {
        const column = new CanvasColumn();
        column.order = getNextOrder(this.columns);
        column.factor = factor;
        this.columns.push(column);
        return column;
    }

    /**
     * Adds a control to the default column for this section
     *
     * @param control Control to add to the default column
     */
    public addControl(control: ColumnControl<any>): this {
        this.defaultColumn.addControl(control);
        return this;
    }

    /**
     * Removes this section and all contained columns and controls from the collection
     */
    public remove(): void {
        this.page.sections = this.page.sections.filter(section => section._memId !== this._memId);
        reindex(this.page.sections);
    }
}

export class CanvasColumn {

    public static Default: IClientSidePageColumnData = {
        controlType: 0,
        displayMode: 2,
        emphasis: {},
        position: {
            layoutIndex: 1,
            sectionFactor: 12,
            sectionIndex: 1,
            zoneIndex: 1,
        },
    };

    private _section: CanvasSection | null;
    private _memId: string;

    constructor(protected json: IClientSidePageColumnData = CanvasColumn.Default, public controls: ColumnControl<any>[] = []) {
        this._section = null;
        this._memId = getGUID();
    }

    public get data(): IClientSidePageColumnData {
        return this.json;
    }

    public get section(): CanvasSection {
        return this._section;
    }

    public set section(section: CanvasSection) {
        this._section = section;
    }

    public get order(): number {
        return this.data.position.sectionIndex;
    }

    public set order(value: number) {
        this.data.position.sectionIndex = value;
    }

    public get factor(): CanvasColumnFactor {
        return this.data.position.sectionFactor;
    }

    public set factor(value: CanvasColumnFactor) {
        this.data.position.sectionFactor = value;
    }

    public addControl(control: ColumnControl<any>): this {
        control.column = this;
        this.controls.push(control);
        return this;
    }

    public getControl<T extends ColumnControl<any>>(index: number): T {
        return <T>this.controls[index];
    }

    public remove(): void {
        this.section.columns = this.section.columns.filter(column => column._memId !== this._memId);
        reindex(this.section.columns);
    }
}

export abstract class ColumnControl<T extends ICanvasControlBaseData> extends CanvasControl<T> {

    private _column: CanvasColumn | null;

    public abstract get order(): number;
    public abstract set order(value: number);

    public get column(): CanvasColumn | null {
        return this._column;
    }

    public set column(value: CanvasColumn) {
        this._column = value;
        this.onColumnChange(this._column);
    }

    public remove(): void {
        this.column.controls = this.column.controls.filter(control => control.id !== this.id);
        reindex(this.column.controls);
    }

    protected abstract onColumnChange(col: CanvasColumn): void;
}

export class ClientSideText extends ColumnControl<IClientSideTextData> {

    public static Default: IClientSideTextData = {
        addedFromPersistedData: false,
        anchorComponentId: "",
        controlType: 4,
        displayMode: 2,
        editorType: "CKEditor",
        emphasis: {},
        id: "",
        innerHTML: "",
        position: {
            controlIndex: 1,
            layoutIndex: 1,
            sectionFactor: 12,
            sectionIndex: 1,
            zoneIndex: 1,
        },
    };

    constructor(text: string, json: IClientSideTextData = ClientSideText.Default) {
        super(json);
        this.text = text;
    }

    public get text(): string {
        return this.data.innerHTML;
    }

    public set text(value: string) {
        if (!value.startsWith("<p>")) {
            value = `<p>${value}</p>`;
        }
        this.data.innerHTML = value;
    }

    public get order(): number {
        return this.data.position.controlIndex;
    }

    public set order(value: number) {
        this.data.position.controlIndex = value;
    }

    protected onColumnChange(col: CanvasColumn): void {
        this.data.position.sectionFactor = col.factor;
        this.data.position.controlIndex = getNextOrder(col.controls);
        this.data.position.zoneIndex = col.data.position.zoneIndex;
        this.data.position.sectionIndex = col.data.position.sectionIndex;
    }
}

export class ClientSideWebpart extends ColumnControl<IClientSideWebPartData> {

    public static Default: IClientSideWebPartData = {
        addedFromPersistedData: false,
        controlType: 3,
        displayMode: 2,
        emphasis: {},
        id: null,
        position: {
            controlIndex: 1,
            sectionFactor: 12,
            sectionIndex: 1,
            zoneIndex: 1,
        },
        reservedHeight: 500,
        reservedWidth: 500,
        webPartData: null,
        webPartId: null,
    };

    constructor(json: IClientSideWebPartData = ClientSideWebpart.Default) {
        super(json);
    }

    public static fromComponentDef(definition: ClientSidePageComponent): ClientSideWebpart {
        const part = new ClientSideWebpart();
        part.import(definition);
        return part;
    }

    public get title(): string {
        return this.data.webPartData.title;
    }

    public set title(value: string) {
        this.data.webPartData.title = value;
    }

    public get description(): string {
        return this.data.webPartData.description;
    }

    public set description(value: string) {
        this.data.webPartData.description = value;
    }

    public get order(): number {
        return this.data.position.controlIndex;
    }

    public set order(value: number) {
        this.data.position.controlIndex = value;
    }

    public get height(): number {
        return this.data.reservedHeight;
    }

    public set height(value: number) {
        this.data.reservedHeight = value;
    }

    public get width(): number {
        return this.data.reservedWidth;
    }

    public set width(value: number) {
        this.data.reservedWidth = value;
    }

    public get dataVersion(): string {
        return this.data.webPartData.dataVersion;
    }

    public set dataVersion(value: string) {
        this.data.webPartData.dataVersion = value;
    }

    public setProperties<T = any>(properties: T): this {
        this.data.webPartData.properties = extend(this.data.webPartData.properties, properties);
        return this;
    }

    public getProperties<T = any>(): T {
        return <T>this.data.webPartData.properties;
    }

    protected onColumnChange(col: CanvasColumn): void {
        this.data.position.sectionFactor = col.factor;
        this.data.position.controlIndex = getNextOrder(col.controls);
        this.data.position.zoneIndex = col.data.position.zoneIndex;
        this.data.position.sectionIndex = col.data.position.sectionIndex;
    }

    protected import(component: ClientSidePageComponent): void {

        const id = getGUID();
        const componendId = component.Id.replace(/^\{|\}$/g, "").toLowerCase();
        const manifest: IClientSidePageComponentManifest = JSON.parse(component.Manifest);
        const preconfiguredEntries = manifest.preconfiguredEntries[0];

        this.setData(Object.assign({}, this.data, <IClientSideWebPartData>{
            id,
            webPartData: {
                dataVersion: "1.0",
                description: preconfiguredEntries.description.default,
                id: componendId,
                instanceId: id,
                properties: preconfiguredEntries.properties,
                title: preconfiguredEntries.title.default,
            },
            webPartId: componendId,
        }));
    }
}

export interface IPageData {
    readonly "odata.metadata": string;
    readonly "odata.type": "SP.Publishing.SitePage";
    readonly "odata.id": string;
    readonly "odata.editLink": string;
    AbsoluteUrl: string;
    AuthorByline: string[] | null;
    BannerImageUrl: string;
    ContentTypeId: null | string;
    Description: string;
    DoesUserHaveEditPermission: boolean;
    FileName: string;
    readonly FirstPublished: string;
    readonly Id: number;
    readonly IsPageCheckedOutToCurrentUser: boolean;
    IsWebWelcomePage: boolean;
    readonly Modified: string;
    PageLayoutType: ClientSidePageLayoutType;
    Path: {
        DecodedUrl: string;
    };
    PromotedState: number;
    Title: string;
    TopicHeader: null | string;
    readonly UniqueId: string;
    Url: string;
    readonly Version: string;
    readonly VersionInfo: {
        readonly LastVersionCreated: string;
        readonly LastVersionCreatedBy: string;
    };
    AlternativeUrlMap: string;
    CanvasContent1: string;
    LayoutWebpartsContent: string;
}

/**
 * Client side webpart object (retrieved via the _api/web/GetClientSideWebParts REST call)
 */
export interface ClientSidePageComponent {
    /**
     * Component type for client side webpart object
     */
    ComponentType: number;
    /**
     * Id for client side webpart object
     */
    Id: string;
    /**
     * Manifest for client side webpart object
     */
    Manifest: string;
    /**
     * Manifest type for client side webpart object
     */
    ManifestType: number;
    /**
     * Name for client side webpart object
     */
    Name: string;
    /**
     * Status for client side webpart object
     */
    Status: number;
}

interface IClientSidePageComponentManifest {
    alias: string;
    componentType: "WebPart" | "" | null;
    disabledOnClassicSharepoint: boolean;
    hiddenFromToolbox: boolean;
    id: string;
    imageLinkPropertyNames: any;
    isInternal: boolean;
    linkPropertyNames: boolean;
    loaderConfig: any;
    manifestVersion: number;
    preconfiguredEntries: {
        description: { default: string };
        group: { default: string };
        groupId: string;
        iconImageUrl: string;
        officeFabricIconFontName: string;
        properties: TypedHash<any>;
        title: { default: string };

    }[];
    preloadComponents: any | null;
    requiredCapabilities: any | null;
    searchablePropertyNames: any | null;
    supportsFullBleed: boolean;
    version: string;
}

export interface IClientSideControlBaseData {
    controlType: number;
}

export interface ICanvasControlBaseData extends IClientSideControlBaseData {
    id: string;
    emphasis: IClientControlEmphasis;
    displayMode: number;
}

export interface IClientSidePageSettingsSlice extends IClientSideControlBaseData {
    pageSettingsSlice: {
        "isDefaultDescription": boolean;
        "isDefaultThumbnail": boolean;
    };
}

export interface IClientSidePageColumnData extends IClientSideControlBaseData {
    controlType: 0;
    displayMode: number;
    emphasis: IClientControlEmphasis;
    position: {
        zoneIndex: number;
        sectionIndex: number;
        sectionFactor: CanvasColumnFactor;
        layoutIndex: number;
    };
}

interface IClientSideControlPositionData {
    zoneIndex: number;
    sectionIndex: number;
    controlIndex: number;
    sectionFactor?: CanvasColumnFactor;
}

export interface IClientSideTextData extends ICanvasControlBaseData {
    controlType: 4;
    position: {
        zoneIndex: number;
        sectionIndex: number;
        controlIndex: number;
        sectionFactor?: CanvasColumnFactor;
        layoutIndex: number;
    };
    anchorComponentId: string;
    editorType: "CKEditor";
    addedFromPersistedData: boolean;
    innerHTML: string;
}

export interface IClientSideWebPartData<PropertiesType = any> extends ICanvasControlBaseData {
    controlType: 3;
    position: {
        zoneIndex: number;
        sectionIndex: number;
        controlIndex: number;
        sectionFactor?: CanvasColumnFactor;
    };
    webPartId: string;
    reservedHeight: number;
    reservedWidth: number;
    addedFromPersistedData: boolean;
    webPartData: {
        id: string;
        instanceId: string;
        title: string;
        description: string;
        serverProcessedContent?: {
            "htmlStrings": TypedHash<string>;
            "searchablePlainTexts": TypedHash<string>;
            "imageSources": TypedHash<string>;
            "links": TypedHash<string>;
        };
        dataVersion: string;
        properties: PropertiesType;
    };
}

export interface IClientControlEmphasis {
    zoneEmphasis?: number;
}

export module ClientSideWebpartPropertyTypes {

    /**
     * Propereties for Embed (component id: 490d7c76-1824-45b2-9de3-676421c997fa)
     */
    export interface Embed {
        embedCode: string;
        cachedEmbedCode?: string;
        shouldScaleWidth?: boolean;
        tempState?: any;
    }

    /**
     * Properties for Bing Map (component id: e377ea37-9047-43b9-8cdb-a761be2f8e09)
     */
    export interface BingMap {
        center: {
            altitude?: number;
            altitudeReference?: number;
            latitude: number;
            longitude: number;
        };
        mapType: "aerial" | "birdseye" | "road" | "streetside";
        maxNumberOfPushPins?: number;
        pushPins?: {
            location: {
                latitude: number;
                longitude: number;
                altitude?: number;
                altitudeReference?: number;
            };
            address?: string;
            defaultAddress?: string;
            defaultTitle?: string;
            title?: string;
        }[];
        shouldShowPushPinTitle?: boolean;
        zoomLevel?: number;
    }
}

export type LayoutType = "FullWidthImage" | "NoImage" | "ColorBlock" | "CutInShape";
export type TextAlignment = "Left" | "Center";

interface ILayoutPartsContent {
    id: string;
    instanceId: string;
    title: string;
    description: string;
    serverProcessedContent: {
        "htmlStrings": TypedHash<string>;
        "searchablePlainTexts": TypedHash<string>;
        "imageSources": TypedHash<string>;
        "links": TypedHash<string>;
    };
    dataVersion: string;
    properties: {
        title: string;
        imageSourceType?: number;
        layoutType: LayoutType;
        textAlignment: TextAlignment;
        showTopicHeader: boolean;
        showPublishDate: boolean;
        topicHeader: string;
        authorByline: string[];
        authors: {
            id: string,
            email: string;
            upn: string;
            name: string;
            role: string;
        }[];
    };
}
