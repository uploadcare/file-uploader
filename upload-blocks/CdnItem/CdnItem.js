import { AppComponent } from '../AppComponent/AppComponent.js';

export class CdnItem extends AppComponent {

}

CdnItem.template = /*html*/ `
<div sub="textContent: cdnUrl"></div>
`;

CdnItem.bindAttributes({
  
});