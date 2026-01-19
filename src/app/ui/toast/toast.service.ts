import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';
import { ComponentType } from '@angular/cdk/portal';

type ToastKind = 'success' | 'error' | 'warn' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private snack: MatSnackBar) {}

  show(message: string, kind: ToastKind = 'info', config?: MatSnackBarConfig) {
    this.snack.open(message, 'OK', {
      duration: kind === 'error' ? 6000 : 3500,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`toast-${kind}`],
      ...config,
    });
  }

  openComponent<T>(
    component: ComponentType<T>,
    config?: MatSnackBarConfig,
  ): MatSnackBarRef<T> {
    return this.snack.openFromComponent(component, {
      horizontalPosition: 'right',
      verticalPosition: 'top',
      ...config,
    });
  }

  success(msg: string, config?: MatSnackBarConfig) { this.show(msg, 'success', config); }
  error(msg: string, config?: MatSnackBarConfig) { this.show(msg, 'error', config); }
  warn(msg: string, config?: MatSnackBarConfig) { this.show(msg, 'warn', config); }
  info(msg: string, config?: MatSnackBarConfig) { this.show(msg, 'info', config); }
}
