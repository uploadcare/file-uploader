import { LitElement } from 'lit';
import { CssDataMixin } from './CssDataMixin';
import { LightDomMixin } from './LightDomMixin';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import { SymbioteMixin } from './SymbioteCompatMixin';

export class BaseComponent extends RegisterableElementMixin(SymbioteMixin()(CssDataMixin(LightDomMixin(LitElement)))) {}
