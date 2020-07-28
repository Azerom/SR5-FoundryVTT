import AbstractItemFactory, { IPreCreateItemData, IPreCreateItemOptions } from './factory/AbstractItemFactory';
import SR5BaseItem, { ISR5BaseItemDataContainer } from './SR5BaseItem';
import { ItemType } from './types/ItemType';
import ArmorFactory from './factory/ArmorFactory';
import WeaponFactory from './factory/WeaponFactory';
import AmmunitionFactory from './factory/AmmunitionFactory';
import MetatypeFactory from './factory/MetatypeFactory';
import SR5Weapon from './SR5Weapon';
import SR5Metatype from './SR5Metatype';
import SR5Ammunition from './SR5Ammunition';
import SR5Armor from './SR5Armor';

export default class SR5ItemProxy extends Item {
    // <editor-fold desc="Static Properties"></editor-fold>
    // <editor-fold desc="Static Methods"></editor-fold>
    // <editor-fold desc="Properties">

    private _implementation: SR5BaseItem;

    // </editor-fold>
    // <editor-fold desc="Constructor & Initialization">
    static async create(data: IPreCreateItemData, options: IPreCreateItemOptions): Promise<Entity> {
        // We use a factory for default data instead of the template. This allows
        // us to correctly synchronize our internal types - the data template is
        // instead used only to create containers in which the data will be stored
        // Handling this internally has a number of benefits. Mostly it allows strong
        // and more thorough typing of data where the JSON template does not.
        let factory: AbstractItemFactory<ISR5BaseItemDataContainer>;
        switch (data.type) {
            case ItemType.Weapon:
                factory = new WeaponFactory();
                break;
            case ItemType.Armor:
                factory = new ArmorFactory();
                break;
            case ItemType.Ammunition:
                factory = new AmmunitionFactory();
                break;
            case ItemType.Metatype:
                factory = new MetatypeFactory();
                break;
        }
        // This will only compile if *every* actor type is handled
        const factoryData = factory.create(data);
        console.warn(`factoryData for ${data.name}`);
        console.warn(factoryData);
        return super.create(factoryData, options);
    }
    constructor(data: BaseEntityData, options?: any) {
        super(data, options);

        switch (data.type as ItemType) {
            case ItemType.Weapon:
                this._implementation = new SR5Weapon(data, options);
                break;
            case ItemType.Armor:
                this._implementation = new SR5Armor(data, options);
                break;
            case ItemType.Ammunition:
                this._implementation = new SR5Ammunition(data, options);
                break;
            case ItemType.Metatype:
                this._implementation = new SR5Metatype(data, options);
                break;
        }
    }

    // </editor-fold>
    // <editor-fold desc="Getters & Setters"></editor-fold>
    // <editor-fold desc="Instance Methods">

    /** @override */
    update(data: any, options: any): Promise<Item> {
        return this._implementation.update(data, options);
    }
    // </editor-fold>
}
