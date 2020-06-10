import { SR5Item } from '../../item/SR5Item';
import { Helpers } from '../../helpers';
import { ShadowrunRoller } from '../../rolls/ShadowrunRoller';
import { SR5Actor } from '../../actor/SR5Actor';

export class ShadowrunRollDialog extends Dialog {
    static async fromItemRoll(
        item: SR5Item,
        event?: MouseEvent
    ): Promise<ShadowrunRollDialog | undefined> {
        const dialogData: DialogData = {
            title: item.name,
            buttons: {},
        };
        if (event) dialogData['event'] = event;

        const templateData = {};
        let templatePath = '';

        if (item.isRangedWeapon()) {
            ShadowrunRollDialog.addRangedWeaponData(templateData, dialogData, item);
            templatePath = 'systems/shadowrun5e/templates/rolls/range-weapon-roll.html';
        } else if (item.isSpell()) {
            ShadowrunRollDialog.addSpellData(templateData, dialogData, item);
            templatePath = 'systems/shadowrun5e/templates/rolls/roll-spell.html';
        } else if (item.isComplexForm()) {
            ShadowrunRollDialog.addComplexFormData(templateData, dialogData, item);
            templatePath = 'systems/shadowrun5e/templates/rolls/roll-complex-form.html';
        }

        if (templatePath) {
            const dialog = await renderTemplate(templatePath, templateData);
            return new ShadowrunRollDialog(
                mergeObject(dialogData, {
                    content: dialog,
                })
            );
        }

        return undefined;
    }

    /*
    static get defaultOptions() {
        const options = super.defaultOptions;
        return mergeObject(options, {
            classes: ['sr5', 'sheet'],
        });
    }
     */

    static addComplexFormData(templateData: object, dialogData: DialogData, item: SR5Item): void {
        const parts = item.getRollPartsList();
        const fade = item.getFade();
        const title = `${Helpers.label(item.name)} Level`;

        templateData['fade'] = fade >= 0 ? `+${fade}` : fade;
        templateData['level'] = 2 - fade;
        templateData['title'] = title;

        let cancel = true;
        dialogData.buttons = {
            roll: {
                label: 'Continue',
                icon: '<i class="fas fa-dice-six"></i>',
                callback: () => (cancel = false),
            },
        };
        dialogData.close = async (html) => {
            if (cancel) return;
            const level = Helpers.parseInputToNumber($(html).find('[name=level]').val());
            await item.setLastComplexFormLevel(level);
            ShadowrunRoller.advancedRoll({
                event: dialogData['event'],
                dialogOptions: {
                    environmental: false,
                },
                parts,
                actor: item.actor,
                limit: {
                    value: level,
                    base: level,
                    label: 'SR5.Level',
                },
                title,
            }).then(() => {
                const totalFade = Math.max(item.getFade() + level, 2);
                item.actor.rollFade({ event: dialogData['event'] }, totalFade);
            });
        };
    }

    static addSpellData(templateData: object, dialogData: DialogData, item: SR5Item): void {
        const parts = item.getRollPartsList();

        const title = `${Helpers.label(item.name)} Force`;

        const drain = item.getDrain();
        templateData['drain'] = drain >= 0 ? `+${drain}` : `${drain}`;
        templateData['force'] = 2 - drain;
        templateData['title'] = title;

        dialogData.title = title;
        let cancel = true;
        let reckless = false;
        dialogData.buttons = {
            normal: {
                label: game.i18n.localize('SR5.NormalSpellButton'),
                callback: () => (cancel = false),
            },
            reckless: {
                label: game.i18n.localize('SR5.RecklessSpellButton'),
                callback: () => {
                    reckless = true;
                    cancel = false;
                },
            },
        };
        dialogData.default = 'normal';
        dialogData.close = async (html) => {
            const force = Helpers.parseInputToNumber($(html).find('[name=force]').val());
            await item.setLastSpellForce(force);
            ShadowrunRoller.advancedRoll({
                event: dialogData['event'],
                dialogOptions: {
                    environmental: true,
                },
                damage: item.getAttackData(0, force)?.damage,
                parts,
                actor: item.actor,
                opposedTest: {
                    label: item.getOpposedRoll(),
                    roll: (actor: SR5Actor, event) => item.rollOpposedTest(actor, event),
                },
                limit: {
                    value: force,
                    base: force,
                    label: 'SR5.Force',
                },
                title: `${title} ${force}`,
            }).then(async (roll: Roll | undefined) => {
                if (item.data.data.category === 'combat' && roll) {
                    const attackData = item.getAttackData(roll.total, force);
                    if (attackData) {
                        await item.setLastAttack(attackData);
                    }
                }
                const drain = Math.max(item.getDrain() + force + (reckless ? 3 : 0), 2);
                item.actor?.rollDrain({ event: dialogData['event'] }, drain);
            });
        };
    }

    static addRangedWeaponData(templateData: object, dialogData: DialogData, item: SR5Item): void {
        const parts = item.getRollPartsList();
        let title = dialogData.title || item.name;

        const itemData = item.data.data;
        const fireModes = {};

        const { modes, ranges, ammo } = itemData.range;
        if (modes.single_shot) {
            fireModes['1'] = 'SS';
        }
        if (modes.semi_auto) {
            fireModes['1'] = 'SA';
            fireModes['3'] = 'SB';
        }
        if (modes.burst_fire) {
            fireModes['3'] = `${modes.semi_auto ? 'SB/' : ''}BF`;
            fireModes['6'] = 'LB';
        }
        if (modes.full_auto) {
            fireModes['6'] = `${modes.burst_fire ? 'LB/' : ''}FA(s)`;
            fireModes['10'] = 'FA(c)';
            fireModes['20'] = game.i18n.localize('SR5.Suppressing');
        }

        const targets = game.user.targets;
        console.log(targets);

        const fireMode = item.getLastFireMode();
        const rc = item.getRecoilCompensation(true);
        templateData['fireModes'] = fireModes;
        templateData['fireMode'] = fireMode;
        templateData['rc'] = rc;
        templateData['ammo'] = ammo;
        templateData['title'] = title;

        let environmental: boolean | number = true;
        let cancel = true;
        const buttons = {};
        buttons['short'] = {
            label: `Short (${ranges.short})`,
            callback: () => (cancel = false),
        };
        buttons['medium'] = {
            label: `Medium (${ranges.medium})`,
            callback: () => {
                environmental = 1;
                cancel = false;
            },
        };
        buttons['long'] = {
            label: `Long (${ranges.long})`,
            callback: () => {
                environmental = 3;
                cancel = false;
            },
        };
        buttons['extreme'] = {
            label: `Extreme (${ranges.extreme})`,
            callback: () => {
                environmental = 6;
                cancel = false;
            },
        };
        dialogData.buttons = buttons;

        dialogData.close = async (html) => {
            if (cancel) return;
            const fireMode = Helpers.parseInputToNumber($(html).find('[name="fireMode"]').val());
            await item.setLastFireMode(fireMode);
            if (fireMode) {
                const defenseModifier = Helpers.mapRoundsToDefenseDesc(fireMode);
                // suppressing fire doesn't cause recoil
                if (fireMode > rc && fireMode !== 20) {
                    parts['SR5.Recoil'] = rc - fireMode;
                }
                let defenseLabel = item.getOpposedRoll();
                if (defenseModifier === 'SR5.DuckOrCover') {
                    defenseLabel = game.i18n.localize(defenseModifier);
                } else if (defenseModifier !== '') {
                    defenseLabel += ` (${defenseModifier})`
                }
                ShadowrunRoller.advancedRoll({
                    event: dialogData['event'],
                    parts,
                    actor: item.actor,
                    limit: item.getLimit(),
                    title,
                    damage: item.getAttackData(0)?.damage,
                    opposedTest: {
                        roll: (actor: SR5Actor, event) => item.rollOpposedTest(actor, event),
                        label: defenseLabel,
                    },
                    dialogOptions: {
                        environmental,
                    },
                }).then((roll: Roll | undefined) => {
                    if (roll) {
                        item.useAmmo(fireMode).then(async () => {
                            const attackData = item.getAttackData(roll.total);
                            if (attackData) {
                                await item.setLastAttack(attackData);
                            }
                            await item.setLastFireMode(fireMode);
                        });
                    }
                });
            }
        };
    }
}
