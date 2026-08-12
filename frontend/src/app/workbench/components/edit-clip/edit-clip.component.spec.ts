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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {EditClipComponent} from './edit-clip.component';
import {MatDialog} from '@angular/material/dialog';
import {NO_ERRORS_SCHEMA} from '@angular/core';

describe('EditClipComponent', () => {
  let component: EditClipComponent;
  let fixture: ComponentFixture<EditClipComponent>;
  let mockMatDialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    mockMatDialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [EditClipComponent],
      providers: [{provide: MatDialog, useValue: mockMatDialog}],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(EditClipComponent, {
        set: {
          providers: [{provide: MatDialog, useValue: mockMatDialog}],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EditClipComponent);
    component = fixture.componentInstance;
    component.disabled = false;
    component.volume = 1.0;
    component.speed = 1.0;
    component.isAudio = false;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('openModal method', () => {
    it('should initialize editing clip properties and open the dialog', () => {
      component.volume = 0.5;
      component.speed = 2.0;
      component.openModal();

      expect(component.editingClipVolume).toBe(0.5);
      expect(component.editingClipSpeed).toBe(2.0);
      expect(mockMatDialog.open).toHaveBeenCalledWith(
        component.editClipPropertiesModal,
        jasmine.any(Object),
      );
    });
  });

  describe('hasChanges getter', () => {
    describe('when isAudio is true', () => {
      beforeEach(() => {
        component.isAudio = true;
        component.volume = 1.0;
        component.speed = 1.0;
      });

      it('should return false if no properties have changed', () => {
        component.editingClipVolume = 1.0;
        component.editingClipSpeed = 1.0;
        expect(component.hasChanges).toBeFalse();
      });

      it('should return true if volume has changed', () => {
        component.editingClipVolume = 0.5;
        component.editingClipSpeed = 1.0;
        expect(component.hasChanges).toBeTrue();
      });

      it('should return true if speed has changed', () => {
        component.editingClipVolume = 1.0;
        component.editingClipSpeed = 1.5;
        expect(component.hasChanges).toBeTrue();
      });
    });

    describe('when isAudio is false', () => {
      beforeEach(() => {
        component.isAudio = false;
        component.volume = 1.0;
        component.speed = 1.0;
      });

      it('should return false if speed has not changed (even if editingClipVolume differs)', () => {
        component.editingClipVolume = 0.5;
        component.editingClipSpeed = 1.0;
        expect(component.hasChanges).toBeFalse();
      });

      it('should return true if speed has changed', () => {
        component.editingClipVolume = 1.0;
        component.editingClipSpeed = 2.0;
        expect(component.hasChanges).toBeTrue();
      });
    });
  });

  describe('isSaveDisabled getter', () => {
    describe('general checks', () => {
      it('should return true if there are no changes', () => {
        component.volume = 1.0;
        component.speed = 1.0;
        component.editingClipVolume = 1.0;
        component.editingClipSpeed = 1.0;
        expect(component.isSaveDisabled).toBeTrue();
      });
    });

    describe('speed validation rules', () => {
      beforeEach(() => {
        component.speed = 1.0;
        // set changes to true
        component.editingClipSpeed = 2.0;
      });

      it('should return true if speed is less than or equal to 0', () => {
        component.editingClipSpeed = 0;
        expect(component.isSaveDisabled).toBeTrue();

        component.editingClipSpeed = -0.5;
        expect(component.isSaveDisabled).toBeTrue();
      });

      it('should return true if speed is greater than 4', () => {
        component.editingClipSpeed = 4.1;
        expect(component.isSaveDisabled).toBeTrue();
      });

      it('should return true if speed is NaN', () => {
        component.editingClipSpeed = NaN;
        expect(component.isSaveDisabled).toBeTrue();
      });

      it('should return false if speed is valid and changed (between 0 and 4)', () => {
        component.editingClipSpeed = 2.5;
        expect(component.isSaveDisabled).toBeFalse();
      });
    });

    describe('volume validation rules (only when isAudio is true)', () => {
      beforeEach(() => {
        component.isAudio = true;
        component.volume = 1.0;
        component.speed = 1.0;
        // default valid change
        component.editingClipVolume = 0.5;
        component.editingClipSpeed = 1.0;
      });

      it('should return true if volume is less than 0', () => {
        component.editingClipVolume = -0.01;
        expect(component.isSaveDisabled).toBeTrue();
      });

      it('should return true if volume is greater than 1', () => {
        component.editingClipVolume = 1.01;
        expect(component.isSaveDisabled).toBeTrue();
      });

      it('should return true if volume is NaN', () => {
        component.editingClipVolume = NaN;
        expect(component.isSaveDisabled).toBeTrue();
      });

      it('should return false if volume is valid (between 0 and 1) and changed', () => {
        component.editingClipVolume = 0.75;
        expect(component.isSaveDisabled).toBeFalse();
      });

      it('should ignore volume validation if isAudio is false', () => {
        component.isAudio = false;
        component.editingClipVolume = 1.5; // normally invalid
        component.editingClipSpeed = 2.0; // valid change
        expect(component.isSaveDisabled).toBeFalse();
      });
    });
  });

  describe('saveClipProperties method', () => {
    it('should emit clipUpdated event with editingClipVolume and editingClipSpeed', () => {
      spyOn(component.clipUpdated, 'emit');
      component.editingClipVolume = 0.8;
      component.editingClipSpeed = 1.5;

      component.saveClipProperties();

      expect(component.clipUpdated.emit).toHaveBeenCalledWith({
        volume: 0.8,
        speed: 1.5,
      });
    });

    it('should fallback to 1.0 speed if editingClipSpeed is falsy', () => {
      spyOn(component.clipUpdated, 'emit');
      component.editingClipVolume = 1.0;
      component.editingClipSpeed = null as any;

      component.saveClipProperties();

      expect(component.clipUpdated.emit).toHaveBeenCalledWith({
        volume: 1.0,
        speed: 1.0,
      });
    });
  });
});
