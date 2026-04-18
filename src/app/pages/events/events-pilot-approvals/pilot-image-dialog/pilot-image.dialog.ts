import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';

type Data = {
  src: string;
  title?: string | null;
  subtitle?: string | null;
};

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pilot-image.dialog.html',
  styleUrl: './pilot-image.dialog.scss',
})
export class PilotImageDialogComponent {
  private ref = inject(DialogRef);
  data = inject<Data>(DIALOG_DATA);

  close() {
    this.ref.close();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.close();
  }
}
