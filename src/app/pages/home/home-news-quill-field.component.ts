import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { QuillEditorComponent } from 'ngx-quill';

@Component({
  standalone: true,
  selector: 'app-home-news-quill-field',
  imports: [FormsModule, QuillEditorComponent, TranslocoPipe],
  template: `
    <div class="news-quill-wrap">
      <quill-editor
        [(ngModel)]="text"
        [readOnly]="readOnly()"
        format="html"
        theme="snow"
        [modules]="modules"
        [styles]="styles"
        [placeholder]="placeholderKey() | transloco"
        name="newsText"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeNewsQuillFieldComponent {
  readonly readOnly = input(false);
  readonly placeholderKey = input<string>('home.quillPlaceholder');
  text = model<string>('');

  readonly modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['blockquote'],
      ['link'],
      ['clean'],
    ],
  };

  readonly styles = { minHeight: '200px' };
}
