import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
    selector: 'app-button',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './button.component.html',
    styleUrls: ['./button.component.scss'],
})
export class ButtonComponent {
    @Input({ required: true }) text: string = '';
    @Input() disabled = false;

    @Output() clicked = new EventEmitter<void>();
}
