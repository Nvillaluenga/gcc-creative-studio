/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  TemplateRef,
  inject,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {SharedModule} from '../../../common/shared.module';

@Component({
  selector: 'app-edit-clip',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    MatButtonModule,
    SharedModule,
  ],
  templateUrl: './edit-clip.component.html',
  styleUrls: ['./edit-clip.component.scss'],
})
export class EditClipComponent {
  @Input() disabled = false;
  @Input() volume = 1.0;
  @Input() speed = 1.0;
  @Output() clipUpdated = new EventEmitter<{volume: number; speed: number}>();
  @Input() isAudio = false;

  editingClipVolume = 1.0;
  editingClipSpeed = 1.0;

  private dialog = inject(MatDialog);
  @ViewChild('editClipPropertiesModal')
  editClipPropertiesModal!: TemplateRef<any>;

  openModal() {
    this.editingClipVolume = this.volume;
    this.editingClipSpeed = this.speed;

    this.dialog.open(this.editClipPropertiesModal, {
      width: '350px',
      panelClass: 'edit-clip-dialog-panel',
    });
  }

  get hasChanges(): boolean {
    return (
      (this.isAudio && this.editingClipVolume !== this.volume) ||
      this.editingClipSpeed !== this.speed
    );
  }

  get isSaveDisabled(): boolean {
    if (!this.hasChanges) {
      return true;
    }
    const speedVal = Number(this.editingClipSpeed);
    // speed must be > 0 and <= 4
    if (isNaN(speedVal) || speedVal <= 0 || speedVal > 4) {
      return true;
    }
    // volume must be between 0 and 1 (only for audio)
    if (this.isAudio) {
      const volumeVal = Number(this.editingClipVolume);
      if (isNaN(volumeVal) || volumeVal < 0 || volumeVal > 1) {
        return true;
      }
    }
    return false;
  }

  saveClipProperties() {
    this.clipUpdated.emit({
      volume: this.editingClipVolume,
      speed: this.editingClipSpeed || 1.0,
    });
  }
}
