import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './waiting-acceptance.page.html',
  styleUrl: './waiting-acceptance.page.scss',
})
export class WaitingAcceptancePage {
  readonly theme = inject(ThemeService);
}
