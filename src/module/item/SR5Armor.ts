import SR5BaseItem, { ISR5BaseItemData, ISR5BaseItemDataContainer } from './SR5BaseItem';
import { ItemType } from './types/ItemType';

export interface ISR5ArmorDataContainer extends ISR5BaseItemDataContainer {
    data: ISR5ArmorData;
    type: ItemType.Armor;
}

export interface ISR5ArmorData extends ISR5BaseItemData {}

export default class SR5Armor extends SR5BaseItem {
    // <editor-fold desc="Static Properties"></editor-fold>
    // <editor-fold desc="Static Methods"></editor-fold>
    // <editor-fold desc="Properties"></editor-fold>
    // <editor-fold desc="Constructor & Initialization"></editor-fold>
    // <editor-fold desc="Getters & Setters"></editor-fold>
    // <editor-fold desc="Instance Methods"></editor-fold>
}
