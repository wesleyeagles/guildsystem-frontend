import { Component, Input } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import {MatIconModule} from '@angular/material/icon';

@Component({
    imports: [RouterLink, RouterLinkActive, MatIconModule],
    standalone: true,
    selector: 'app-link-component',
    templateUrl: './link.component.html',
    styleUrl: './link.component.scss'
})
export class LinkComponent {
    @Input({ required: true }) route: string = ''
    @Input({ required: true }) label: string = ''
    @Input({ required: true }) icon: string = ''
}