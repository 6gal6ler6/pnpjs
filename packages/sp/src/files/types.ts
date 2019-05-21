import {
    _SharePointQueryableInstance,
    ISharePointQueryableCollection,
    ISharePointQueryableInstance,
    _SharePointQueryableCollection,
    spInvokableFactory,
} from "../sharepointqueryable";
import { TextParser, BlobParser, JSONParser, BufferParser, IInvokable, headers } from "@pnp/odata";
import { extend, getGUID } from "@pnp/common";
import { Item, IItem } from "../items";
import { odataUrlFrom } from "../odata";
import { defaultPath, IDeleteableWithETag, deleteableWithETag } from "../decorators";
import { spPost } from "../operations";
import { escapeQueryStrValue } from "../utils/escapeSingleQuote";

export interface IFileUploadProgressData {
    uploadId: string;
    stage: "starting" | "continue" | "finishing";
    blockNumber: number;
    totalBlocks: number;
    chunkSize: number;
    currentPointer: number;
    fileSize: number;
}

/**
 * Describes a collection of File objects
 *
 */
@defaultPath("files")
export class _Files extends _SharePointQueryableCollection implements IFiles {

    /**
     * Gets a File by filename
     *
     * @param name The name of the file, including extension.
     */
    public getByName(name: string): IFile {
        return File(this).concat(`('${name}')`);
    }

    /**
     * Uploads a file. Not supported for batching
     *
     * @param url The folder-relative url of the file.
     * @param content The file contents blob.
     * @param shouldOverWrite Should a file with the same name in the same location be overwritten? (default: true)
     * @returns The new File and the raw response.
     */
    public async add(url: string, content: string | ArrayBuffer | Blob, shouldOverWrite = true): Promise<IFileAddResult> {
        const response = spPost(Files(this, `add(overwrite=${shouldOverWrite},url='${escapeQueryStrValue(url)}')`), {
            body: content,
        });
        return {
            data: response,
            file: this.getByName(url),
        };
    }

    /**
     * Uploads a file. Not supported for batching
     *
     * @param url The folder-relative url of the file.
     * @param content The Blob file content to add
     * @param progress A callback function which can be used to track the progress of the upload
     * @param shouldOverWrite Should a file with the same name in the same location be overwritten? (default: true)
     * @param chunkSize The size of each file slice, in bytes (default: 10485760)
     * @returns The new File and the raw response.
     */
    public async addChunked(url: string, content: Blob, progress?: (data: IFileUploadProgressData) => void, shouldOverWrite = true, chunkSize = 10485760): Promise<IFileAddResult> {

        await spPost(this.clone(Files, `add(overwrite=${shouldOverWrite},url='${escapeQueryStrValue(url)}')`, false));
        const file = this.getByName(url);
        return await file.setContentChunked(content, progress, chunkSize);
    }

    /**
     * Adds a ghosted file to an existing list or document library. Not supported for batching.
     *
     * @param fileUrl The server-relative url where you want to save the file.
     * @param templateFileType The type of use to create the file.
     * @returns The template file that was added and the raw response.
     */
    public async addTemplateFile(fileUrl: string, templateFileType: TemplateFileType): Promise<IFileAddResult> {
        const response = await spPost(this.clone(Files, `addTemplateFile(urloffile='${escapeQueryStrValue(fileUrl)}',templatefiletype=${templateFileType})`, false));
        return {
            data: response,
            file: this.getByName(fileUrl),
        };
    }
}

export interface IFiles extends IInvokable, ISharePointQueryableCollection {
    getByName(name: string): IFile;
    add(url: string, content: string | ArrayBuffer | Blob, shouldOverWrite?: boolean): Promise<IFileAddResult>;
    addChunked(url: string, content: Blob, progress?: (data: IFileUploadProgressData) => void, shouldOverWrite?: boolean, chunkSize?: number): Promise<IFileAddResult>;
    addTemplateFile(fileUrl: string, templateFileType: TemplateFileType): Promise<IFileAddResult>;
}
export interface _Files extends IInvokable { }
export const Files = spInvokableFactory<IFiles>(_Files);

/**
 * Describes a single File instance
 *
 */
@deleteableWithETag()
export class _File extends _SharePointQueryableInstance implements IFile {

    /**
     * Gets a value that specifies the list item field values for the list item corresponding to the file.
     *
     */
    public get listItemAllFields(): _SharePointQueryableInstance {
        return new _SharePointQueryableInstance(this, "listItemAllFields");
    }

    /**
     * Gets a collection of versions
     *
     */
    public get versions(): IVersions {
        return Versions(this);
    }

    /**
     * Approves the file submitted for content approval with the specified comment.
     * Only documents in lists that are enabled for content approval can be approved.
     *
     * @param comment The comment for the approval.
     */
    public approve(comment = ""): Promise<void> {
        return spPost(this.clone(File, `approve(comment='${escapeQueryStrValue(comment)}')`));
    }

    /**
     * Stops the chunk upload session without saving the uploaded data. Does not support batching.
     * If the file doesn’t already exist in the library, the partially uploaded file will be deleted.
     * Use this in response to user action (as in a request to cancel an upload) or an error or exception.
     * Use the uploadId value that was passed to the StartUpload method that started the upload session.
     * This method is currently available only on Office 365.
     *
     * @param uploadId The unique identifier of the upload session.
     */
    public cancelUpload(uploadId: string): Promise<void> {
        return spPost(this.clone(File, `cancelUpload(uploadId=guid'${uploadId}')`, false));
    }

    /**
     * Checks the file in to a document library based on the check-in type.
     *
     * @param comment A comment for the check-in. Its length must be <= 1023.
     * @param checkinType The check-in type for the file.
     */
    public checkin(comment = "", checkinType = CheckinType.Major): Promise<void> {

        if (comment.length > 1023) {
            throw Error("The maximum comment length is 1023 characters.");
        }

        return spPost(this.clone(File, `checkin(comment='${escapeQueryStrValue(comment)}',checkintype=${checkinType})`));
    }

    /**
     * Checks out the file from a document library.
     */
    public checkout(): Promise<void> {
        return spPost(this.clone(File, "checkout"));
    }

    /**
     * Copies the file to the destination url.
     *
     * @param url The absolute url or server relative url of the destination file path to copy to.
     * @param shouldOverWrite Should a file with the same name in the same location be overwritten?
     */
    public copyTo(url: string, shouldOverWrite = true): Promise<void> {
        return spPost(this.clone(File, `copyTo(strnewurl='${escapeQueryStrValue(url)}',boverwrite=${shouldOverWrite})`));
    }

    /**
     * Denies approval for a file that was submitted for content approval.
     * Only documents in lists that are enabled for content approval can be denied.
     *
     * @param comment The comment for the denial.
     */
    public deny(comment = ""): Promise<void> {
        if (comment.length > 1023) {
            throw Error("The maximum comment length is 1023 characters.");
        }
        return spPost(this.clone(File, `deny(comment='${escapeQueryStrValue(comment)}')`));
    }

    /**
     * Moves the file to the specified destination url.
     *
     * @param url The absolute url or server relative url of the destination file path to move to.
     * @param moveOperations The bitwise MoveOperations value for how to move the file.
     */
    public moveTo(url: string, moveOperations = MoveOperations.Overwrite): Promise<void> {
        return spPost(this.clone(File, `moveTo(newurl='${escapeQueryStrValue(url)}',flags=${moveOperations})`));
    }

    /**
     * Submits the file for content approval with the specified comment.
     *
     * @param comment The comment for the published file. Its length must be <= 1023.
     */
    public publish(comment = ""): Promise<void> {
        if (comment.length > 1023) {
            throw Error("The maximum comment length is 1023 characters.");
        }
        return spPost(this.clone(File, `publish(comment='${escapeQueryStrValue(comment)}')`));
    }

    /**
     * Moves the file to the Recycle Bin and returns the identifier of the new Recycle Bin item.
     *
     * @returns The GUID of the recycled file.
     */
    public recycle(): Promise<string> {
        return spPost(this.clone(File, "recycle"));
    }

    /**
     * Reverts an existing checkout for the file.
     *
     */
    public undoCheckout(): Promise<void> {
        return spPost(this.clone(File, "undoCheckout"));
    }

    /**
     * Removes the file from content approval or unpublish a major version.
     *
     * @param comment The comment for the unpublish operation. Its length must be <= 1023.
     */
    public unpublish(comment = ""): Promise<void> {
        if (comment.length > 1023) {
            throw Error("The maximum comment length is 1023 characters.");
        }
        return spPost(this.clone(File, `unpublish(comment='${escapeQueryStrValue(comment)}')`));
    }

    /**
     * Gets the contents of the file as text. Not supported in batching.
     *
     */
    public getText(): Promise<string> {

        return this.clone(File, "$value", false).usingParser(new TextParser())(headers({ "binaryStringResponseBody": "true" }));
    }

    /**
     * Gets the contents of the file as a blob, does not work in Node.js. Not supported in batching.
     *
     */
    public getBlob(): Promise<Blob> {

        return this.clone(File, "$value", false).usingParser(new BlobParser())(headers({ "binaryStringResponseBody": "true" }));
    }

    /**
     * Gets the contents of a file as an ArrayBuffer, works in Node.js. Not supported in batching.
     */
    public getBuffer(): Promise<ArrayBuffer> {

        return this.clone(File, "$value", false).usingParser(new BufferParser())(headers({ "binaryStringResponseBody": "true" }));
    }

    /**
     * Gets the contents of a file as an ArrayBuffer, works in Node.js. Not supported in batching.
     */
    public getJSON(): Promise<any> {

        return this.clone(File, "$value", false).usingParser(new JSONParser())(headers({ "binaryStringResponseBody": "true" }));
    }

    /**
     * Sets the content of a file, for large files use setContentChunked. Not supported in batching.
     *
     * @param content The file content
     *
     */
    public async setContent(content: string | ArrayBuffer | Blob): Promise<IFile> {

        await spPost(this.clone(File, "$value", false), {
            body: content,
            headers: {
                "X-HTTP-Method": "PUT",
            },
        });
        return File(this);
    }

    /**
     * Gets the associated list item for this folder, loading the default properties
     */
    public getItem<T>(...selects: string[]): Promise<IItem & T> {

        const q = this.listItemAllFields;
        return q.select.apply(q, selects)().then((d: any) => {

            return extend(Item(odataUrlFrom(d)), d);
        });
    }

    /**
     * Sets the contents of a file using a chunked upload approach. Not supported in batching.
     *
     * @param file The file to upload
     * @param progress A callback function which can be used to track the progress of the upload
     * @param chunkSize The size of each file slice, in bytes (default: 10485760)
     */
    public setContentChunked(file: Blob, progress?: (data: IFileUploadProgressData) => void, chunkSize = 10485760): Promise<IFileAddResult> {

        if (progress === undefined) {
            progress = () => null;
        }

        const fileSize = file.size;
        const blockCount = parseInt((file.size / chunkSize).toString(), 10) + ((file.size % chunkSize === 0) ? 1 : 0);
        const uploadId = getGUID();

        // start the chain with the first fragment
        progress({ uploadId, blockNumber: 1, chunkSize, currentPointer: 0, fileSize, stage: "starting", totalBlocks: blockCount });

        let chain = this.startUpload(uploadId, file.slice(0, chunkSize));

        // skip the first and last blocks
        for (let i = 2; i < blockCount; i++) {
            chain = chain.then(pointer => {
                progress({ uploadId, blockNumber: i, chunkSize, currentPointer: pointer, fileSize, stage: "continue", totalBlocks: blockCount });
                return this.continueUpload(uploadId, pointer, file.slice(pointer, pointer + chunkSize));
            });
        }

        return chain.then(pointer => {
            progress({ uploadId, blockNumber: blockCount, chunkSize, currentPointer: pointer, fileSize, stage: "finishing", totalBlocks: blockCount });
            return this.finishUpload(uploadId, pointer, file.slice(pointer));
        });
    }

    /**
     * Starts a new chunk upload session and uploads the first fragment.
     * The current file content is not changed when this method completes.
     * The method is idempotent (and therefore does not change the result) as long as you use the same values for uploadId and stream.
     * The upload session ends either when you use the CancelUpload method or when you successfully
     * complete the upload session by passing the rest of the file contents through the ContinueUpload and FinishUpload methods.
     * The StartUpload and ContinueUpload methods return the size of the running total of uploaded data in bytes,
     * so you can pass those return values to subsequent uses of ContinueUpload and FinishUpload.
     * This method is currently available only on Office 365.
     *
     * @param uploadId The unique identifier of the upload session.
     * @param fragment The file contents.
     * @returns The size of the total uploaded data in bytes.
     */
    protected async startUpload(uploadId: string, fragment: ArrayBuffer | Blob): Promise<number> {
        let n = await spPost(this.clone(File, `startUpload(uploadId=guid'${uploadId}')`, false), { body: fragment });
        if (typeof n === "object") {
            // When OData=verbose the payload has the following shape:
            // { StartUpload: "10485760" }
            n = (n as any).StartUpload;
        }
        return parseFloat(n);
    }

    /**
     * Continues the chunk upload session with an additional fragment.
     * The current file content is not changed.
     * Use the uploadId value that was passed to the StartUpload method that started the upload session.
     * This method is currently available only on Office 365.
     *
     * @param uploadId The unique identifier of the upload session.
     * @param fileOffset The size of the offset into the file where the fragment starts.
     * @param fragment The file contents.
     * @returns The size of the total uploaded data in bytes.
     */
    protected async continueUpload(uploadId: string, fileOffset: number, fragment: ArrayBuffer | Blob): Promise<number> {
        let n = await spPost(this.clone(File, `continueUpload(uploadId=guid'${uploadId}',fileOffset=${fileOffset})`, false), { body: fragment });
        if (typeof n === "object") {
            // When OData=verbose the payload has the following shape:
            // { ContinueUpload: "20971520" }
            n = (n as any).ContinueUpload;
        }
        return parseFloat(n);
    }

    /**
     * Uploads the last file fragment and commits the file. The current file content is changed when this method completes.
     * Use the uploadId value that was passed to the StartUpload method that started the upload session.
     * This method is currently available only on Office 365.
     *
     * @param uploadId The unique identifier of the upload session.
     * @param fileOffset The size of the offset into the file where the fragment starts.
     * @param fragment The file contents.
     * @returns The newly uploaded file.
     */
    protected async finishUpload(uploadId: string, fileOffset: number, fragment: ArrayBuffer | Blob): Promise<IFileAddResult> {
        const response = await spPost(this.clone(File, `finishUpload(uploadId=guid'${uploadId}',fileOffset=${fileOffset})`, false), { body: fragment });
        return {
            data: response,
            file: File(odataUrlFrom(response)),
        };
    }
}

export interface IFile extends IInvokable, ISharePointQueryableInstance, IDeleteableWithETag {
    readonly listItemAllFields: ISharePointQueryableInstance;
    readonly versions: IVersions;
    approve(comment?: string): Promise<void>;
    cancelUpload(uploadId: string): Promise<void>;
    checkin(comment?: string, checkinType?: CheckinType): Promise<void>;
    checkout(): Promise<void>;
    copyTo(url: string, shouldOverWrite?: boolean): Promise<void>;
    deny(comment?: string): Promise<void>;
    moveTo(url: string, moveOperations?: MoveOperations): Promise<void>;
    publish(comment?: string): Promise<void>;
    recycle(): Promise<string>;
    undoCheckout(): Promise<void>;
    unpublish(comment?: string): Promise<void>;
    getText(): Promise<string>;
    getBlob(): Promise<Blob>;
    getBuffer(): Promise<ArrayBuffer>;
    getJSON(): Promise<any>;
    setContent(content: string | ArrayBuffer | Blob): Promise<IFile>;
    getItem<T>(...selects: string[]): Promise<IItem & T>;
    setContentChunked(file: Blob, progress?: (data: IFileUploadProgressData) => void, chunkSize?: number): Promise<IFileAddResult>;
}
export interface _File extends IInvokable, IDeleteableWithETag { }
export const File = spInvokableFactory<IFile>(_File);

/**
 * Describes a collection of Version objects
 *
 */
@defaultPath("versions")
export class _Versions extends _SharePointQueryableCollection implements IVersions {

    /**	
     * Gets a version by id	
     *	
     * @param versionId The id of the version to retrieve	
     */
    public getById(versionId: number): IVersion {
        return Version(this).concat(`(${versionId})`);
    }

    /**
     * Deletes all the file version objects in the collection.
     *
     */
    public deleteAll(): Promise<void> {
        return spPost(Versions(this, "deleteAll"));
    }

    /**
     * Deletes the specified version of the file.
     *
     * @param versionId The ID of the file version to delete.
     */
    public deleteById(versionId: number): Promise<void> {
        return spPost(this.clone(Versions, `deleteById(vid=${versionId})`));
    }

    /**
     * Recycles the specified version of the file.
     *
     * @param versionId The ID of the file version to delete.
     */
    public recycleByID(versionId: number): Promise<void> {
        return spPost(this.clone(Versions, `recycleByID(vid=${versionId})`));
    }

    /**
     * Deletes the file version object with the specified version label.
     *
     * @param label The version label of the file version to delete, for example: 1.2
     */
    public deleteByLabel(label: string): Promise<void> {
        return spPost(this.clone(Versions, `deleteByLabel(versionlabel='${escapeQueryStrValue(label)}')`));
    }

    /**
     * Recycles the file version object with the specified version label.
     *
     * @param label The version label of the file version to delete, for example: 1.2
     */
    public recycleByLabel(label: string): Promise<void> {
        return spPost(this.clone(Versions, `recycleByLabel(versionlabel='${escapeQueryStrValue(label)}')`));
    }

    /**
     * Creates a new file version from the file specified by the version label.
     *
     * @param label The version label of the file version to restore, for example: 1.2
     */
    public restoreByLabel(label: string): Promise<void> {
        return spPost(this.clone(Versions, `restoreByLabel(versionlabel='${escapeQueryStrValue(label)}')`));
    }
}

export interface IVersions extends IInvokable, ISharePointQueryableCollection {
    getById(versionId: number): IVersion;
    deleteAll(): Promise<void>;
    deleteById(versionId: number): Promise<void>;
    recycleByID(versionId: number): Promise<void>;
    deleteByLabel(label: string): Promise<void>;
    recycleByLabel(label: string): Promise<void>;
    restoreByLabel(label: string): Promise<void>;
}
export interface _Versions extends IInvokable { }
export const Versions = spInvokableFactory<IVersions>(_Versions);

/**
 * Describes a single Version instance
 *
 */
@deleteableWithETag()
export class _Version extends _SharePointQueryableInstance { }

export interface IVersion extends IInvokable, ISharePointQueryableInstance, IDeleteableWithETag { }
export interface _Version extends IInvokable, IDeleteableWithETag { }
export const Version = spInvokableFactory<IVersion>(_Version);

export enum CheckinType {
    Minor = 0,
    Major = 1,
    Overwrite = 2,
}

export interface IFileAddResult {
    file: IFile;
    data: any;
}

export enum MoveOperations {
    Overwrite = 1,
    AllowBrokenThickets = 8,
}

export enum TemplateFileType {
    StandardPage = 0,
    WikiPage = 1,
    FormPage = 2,
    ClientSidePage = 3,
}
