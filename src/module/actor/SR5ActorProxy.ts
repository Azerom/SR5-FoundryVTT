import SR5Runner from './SR5Runner';
import SR5Grunt from './SR5Grunt';
import { ActorType } from './types/ActorType';
import SR5BaseActor from './SR5BaseActor';

export default class SR5ActorProxy extends Actor {
    // <editor-fold desc="Static Properties"></editor-fold>
    // <editor-fold desc="Static Methods"></editor-fold>
    // <editor-fold desc="Properties">

    private readonly _implementation: SR5BaseActor;

    // </editor-fold>
    // <editor-fold desc="Constructor & Initialization">

    constructor(data: ActorData, options?: any) {
        super(data, options);

        switch (this.data.type) {
            case ActorType.Runner:
                this._implementation = new SR5Runner(this, data, options);
                break;
            case ActorType.Grunt:
                this._implementation = new SR5Grunt(this, data, options);
                break;
            case ActorType.Spirit:
                break;
            case ActorType.Sprite:
                break;
            case ActorType.Vehicle:
                break;
            case ActorType.Host:
                break;
            case ActorType.IC:
                break;
        }
    }

    // TODO: These can't be proxy'd because they're called in the constructor
    //  of Actor or a parent class. However, that does mean our 'real' actor
    //  also has it's data prepared in the constructor. Functionally, we might
    //  (maybe even *should*) be OK simply only forwarding preparation requests
    //  after the class has been constructed.
    /** @override */
    prepareData(): void {
        console.warn(`PROXY prepareData`);
        if (this._implementation !== undefined) {
            this._implementation.prepareData();
        }

        return super.prepareData();
    }
    /** @override */
    prepareEmbeddedEntities(): void {
        console.warn(`PROXY prepareEmbeddedEntities`);
        if (this._implementation !== undefined) {
            this._implementation.prepareEmbeddedEntities();
        }

        return super.prepareEmbeddedEntities();
    }

    // TODO: These should be OK to proxy straight up.

    /** @override */
    get itemTypes(): { [key: string]: Item[] } {
        return this._implementation.itemTypes;
    }

    /** @override */
    get img(): string {
        return this._implementation.img;
    }

    /** @override */
    get isPC(): boolean {
        return this._implementation.isPC;
    }

    /** @override */
    get isToken(): boolean {
        return this._implementation.isToken;
    }

    /** @override */
    getActiveTokens(linked?: boolean): Token[] {
        return this._implementation.getActiveTokens(linked);
    }

    /** @override */
    getTokenImages(): Promise<any> {
        return this._implementation.getTokenImages();
    }

    /** @override */
    modifyTokenAttributes(attribute: string, value: number, isDelta?: boolean, isBar?: boolean): Promise<Actor> {
        return this._implementation.modifyTokenAttributes(attribute, value, isDelta, isBar);
    }

    /** @override */
    update(data: object, options?: object): Promise<Actor> {
        return this._implementation.update(data, options);
    }

    /** @override */
    delete(options?: object): Promise<string> {
        return this._implementation.delete(options);
    }

    /** @override */
    createEmbeddedEntity(embeddedName: string, createData: object, options?: object): Promise<Actor> {
        return this._implementation.createEmbeddedEntity(embeddedName, createData, options);
    }

    /** @override */
    updateEmbeddedEntity(embeddedName: string, updateData: object, options?: object): Promise<Actor> {
        return this._implementation.updateEmbeddedEntity(embeddedName, updateData, options);
    }

    /** @override */
    deleteEmbeddedEntity(embeddedName: string, childId: string, options?: object): Promise<Actor> {
        return this._implementation.deleteEmbeddedEntity(embeddedName, childId, options);
    }

    /** @override */
    importItemFromCollection(collection: string, entryId: string): Item {
        return this._implementation.importItemFromCollection(collection, entryId);
    }

    /** @override */
    getOwnedItem(itemId: string): Item | null {
        return this._implementation.getOwnedItem(itemId);
    }

    /** @override */
    createOwnedItem(itemData: object, options?: object): Promise<Item> {
        return this._implementation.createOwnedItem(itemData, options);
    }

    /** @override */
    updateOwnedItem(itemData: object, options?: object): Promise<Item> {
        return this._implementation.updateOwnedItem(itemData, options);
    }

    /** @override */
    updateManyOwnedItems(data: object, options?: object): Promise<Item[]> {
        return this._implementation.updateManyOwnedItems(data, options);
    }

    /** @override */
    deleteOwnedItem(itemId: string, options?: object): Promise<Item> {
        return this._implementation.deleteOwnedItem(itemId, options);
    }

    // </editor-fold>
    // <editor-fold desc="Getters & Setters"></editor-fold>
    // <editor-fold desc="Instance Methods"></editor-fold>
}
