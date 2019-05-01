import { TestBed } from '@angular/core/testing';

import { PageParamsPassingService } from './page-params-passing.service';

describe('PageParamsPassingService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: PageParamsPassingService = TestBed.get(PageParamsPassingService);
    expect(service).toBeTruthy();
  });
});
