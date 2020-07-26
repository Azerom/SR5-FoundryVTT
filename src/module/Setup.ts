import SR5ActorProxy from './actor/SR5ActorProxy';
import SR5BaseItem from './item/SR5BaseItem';
import { SYSTEM_NAME } from './Constants';
import SR5BaseActorSheet from './actor/sheet/SR5BaseActorSheet';
import SR5ItemProxy from './item/SR5ItemProxy';
import SR5BaseItemSheet from './item/sheet/SR5BaseItemSheet';

export default class Setup {
    public static run(): void {
        Hooks.once('init', this.init);
        Hooks.once('setup', this.setup);
        Hooks.once('ready', this.ready);
    }

    // Tasks called on init
    protected static init(): Promise<void> {
        // Register actor + sheets
        CONFIG.Actor.entityClass = SR5ActorProxy;
        Actors.unregisterSheet('core', ActorSheet);
        Actors.registerSheet(SYSTEM_NAME, SR5BaseActorSheet, { makeDefault: true });

        // Register item + sheets
        CONFIG.Item.entityClass = SR5ItemProxy;
        Items.unregisterSheet('core', ItemSheet);
        Items.registerSheet(SYSTEM_NAME, SR5BaseItemSheet, { makeDefault: true });

        // Above code will run synchronously with Foundry
        // Async tasks can be done by returning a new Promise
        return Promise.resolve();
    }
    protected static async setup(): Promise<void> {}
    protected static async ready(): Promise<void> {}
}
