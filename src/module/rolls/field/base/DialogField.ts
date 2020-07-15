import { RollData } from '../../dialog/RollDialog';
import { SR5Actor } from '../../../actor/SR5Actor';

export abstract class DialogField<TValue extends { toString: () => string }> extends HTMLElement {
    // <editor-fold desc="Static Properties"></editor-fold>
    // <editor-fold desc="Static Methods"></editor-fold>
    // <editor-fold desc="Properties">

    /**
     * The localization key of the label.
     */
    protected readonly labelKey: string;

    /**
     * Internal stored value of this field.
     */
    private _value: TValue;

    /**
     * The label associated with this field.
     */
    private _label: HTMLLabelElement;

    // </editor-fold>
    // <editor-fold desc="Constructor & Initialization">

    protected constructor(id: string, label: string, value: TValue) {
        super();

        this.id = id;
        this.labelKey = label;
        this._value = value;
    }

    // </editor-fold>
    // <editor-fold desc="Getters & Setters">

    // Read Only

    /**
     * The class(es) that should be applied to the container.
     */
    public get fieldClass(): string {
        return 'form-group';
    }

    /**
     * The class(es) that should be applied to the input.
     */
    public get inputClass(): string {
        return 'display';
    }

    /**
     * The class(es) that should be applied to the label.
     */
    public get labelClass(): string {
        return 'display';
    }

    /**
     * The label associated with this field.
     */
    public get label(): HTMLLabelElement {
        return this._label;
    }

    // Read + Write

    /**
     * Get the value for this field. Can be overridden if type coercion is needed.
     */
    public getValue(): TValue {
        return this._value;
    }

    /**
     * Set the value for this field. Can be overridden if type coercion is needed.
     * @param value
     */
    public setValue(value: TValue) {
        this._value = value;
    }

    // </editor-fold>
    // <editor-fold desc="Instance Methods">

    /**
     * Get an id for the specified child element
     * @param type
     */
    public getIdForChild(type: 'label' | 'input') {
        return `${this.id}-${type}`;
    }

    /**
     * This gets called when the element has been connected to the DOM. It's private so it doesn't get overwritten
     * by accident. If you want more elements you should use {@see createAdditionalElements} instead.
     */
    private connectedCallback() {
        this.setAttribute('class', this.fieldClass);

        const label = this.createLabel();
        const input = this.createInput();

        input.onchange = this.onInputChanged.bind(this);
        input.oninput = this.onInputChanged.bind(this);

        this.append(label);
        this.append(input);

        this._label = label;

        label.setAttribute('class', this.labelClass);
        input.setAttribute('class', this.inputClass);

        this.createAdditionalElements();
    }

    /**
     * Create any additional elements this field needs.
     */
    protected createAdditionalElements() {}

    /**
     * Create the label to be used in this field.
     */
    protected createLabel(): HTMLLabelElement {
        const label = document.createElement('label');

        label.id = this.getIdForChild('label');
        label.setAttribute('for', this.getIdForChild('input'));
        label.innerText = game.i18n.localize(this.labelKey);

        return label;
    }

    /**
     * Create the input to be used in this field.
     */
    protected abstract createInput(): HTMLElement;

    /**
     * Callback executed when input is changed.
     * @param event
     */
    protected abstract onInputChanged(event: Event);

    /**
     * Collects relevant data from the actor or fields and places it in the RollData object for use.
     * @param actor
     * @param data
     */
    public abstract collect(actor: SR5Actor | undefined, data: RollData);

    // </editor-fold>
}
