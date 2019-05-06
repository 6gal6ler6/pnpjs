import { _GraphQueryableCollection, IGraphQueryableCollection, IGraphQueryableInstance, _GraphQueryableInstance, graphInvokableFactory } from "../graphqueryable";
import { DirectoryObject as IDirectoryObjectType } from "@microsoft/microsoft-graph-types";
import { defaultPath, getById, IGetById, deleteable, IDeleteable } from "../decorators";
import { IGetable, body } from "@pnp/odata";
import { graphPost } from "../operations";

/**
 * Represents a Directory Object entity
 */
@deleteable()
export class _DirectoryObject<GetType = IDirectoryObjectType> extends _GraphQueryableInstance<GetType> implements IDirectoryObject<GetType> {

    /**
     * Returns all the groups and directory roles that the specified Directory Object is a member of. The check is transitive
     * 
     * @param securityEnabledOnly 
     */
    public getMemberObjects(securityEnabledOnly = false): Promise<{ value: string[] }> {
        return graphPost(this.clone(DirectoryObject, "getMemberObjects"), body({ securityEnabledOnly }));
    }

    /**
     * Returns all the groups that the specified Directory Object is a member of. The check is transitive
     * 
     * @param securityEnabledOnly 
     */
    public getMemberGroups(securityEnabledOnly = false): Promise<{ value: string[] }> {
        return graphPost(this.clone(DirectoryObject, "getMemberGroups"), body({ securityEnabledOnly }));
    }

    /**
     * Check for membership in a specified list of groups, and returns from that list those groups of which the specified user, group, or directory object is a member. 
     * This function is transitive.
     * @param groupIds A collection that contains the object IDs of the groups in which to check membership. Up to 20 groups may be specified.
     */
    public checkMemberGroups(groupIds: String[]): Promise<{ value: string[] }> {
        return graphPost(this.clone(DirectoryObject, "checkMemberGroups"), body({ groupIds }));
    }
}
export interface IDirectoryObject<GetType = IDirectoryObjectType> extends IGetable, IDeleteable, IGraphQueryableInstance<GetType> {
    getMemberObjects(securityEnabledOnly?: boolean): Promise<{ value: string[] }>;
    getMemberGroups(securityEnabledOnly?: boolean): Promise<{ value: string[] }>;
    checkMemberGroups(groupIds: String[]): Promise<{ value: string[] }>;
 }
export interface _DirectoryObject extends IGetable, IDeleteable { }
export const DirectoryObject = graphInvokableFactory<IDirectoryObject>(_DirectoryObject);

/**
 * Describes a collection of Directory Objects
 *
 */
@defaultPath("directoryObjects")
@getById(DirectoryObject)
export class _DirectoryObjects<GetType = IDirectoryObjectType[]> extends _GraphQueryableCollection<GetType> implements IDirectoryObjects<GetType> {
    public getByIds(ids: string[], type: DirectoryObjectTypes = DirectoryObjectTypes.directoryObject): Promise<IDirectoryObjectType[]> {
        return graphPost(this.clone(DirectoryObjects, "getByIds"), body({ ids, type }));
    }
}
export interface IDirectoryObjects<GetType = IDirectoryObjectType[]> extends IGetable, IGetById<IDirectoryObjectType>, IGraphQueryableCollection<GetType> {
    /**
    * Returns the directory objects specified in a list of ids. NOTE: The directory objects returned are the full objects containing all their properties. 
    * The $select query option is not available for this operation.
    * 
    * @param ids A collection of ids for which to return objects. You can specify up to 1000 ids.
    * @param type A collection of resource types that specifies the set of resource collections to search. Default is directoryObject.
    */
    getByIds(ids: string[], type?: DirectoryObjectTypes): Promise<IDirectoryObjectType[]>;
}
export interface _DirectoryObjects extends IGetable, IGetById<any> { }
export const DirectoryObjects = graphInvokableFactory<IDirectoryObjects>(_DirectoryObjects);

/**
 * DirectoryObjectTypes
 */
export enum DirectoryObjectTypes {
    /**
     * Directory Objects
     */
    directoryObject,
    /**
     * User
     */
    user,
    /**
     * Group
     */
    group,
    /**
     * Device
     */
    device,
}
