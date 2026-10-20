import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { BookingError, BookingService } from './booking.service';
import { SlotSelection } from '../models/booking.models';

const SLOT: SlotSelection = {
  start: '2026-10-02T08:30:00.000Z',
  timezone: 'Africa/Lagos',
};

const REQUEST = {
  requestName: 'API audit',
  description: 'We need a full audit of our REST surface.',
  email: 'cto@acme.io',
};

describe('BookingService', () => {
  let service: BookingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BookingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('person consultation form', () => {
    it('starts invalid and requires name, email and phone', () => {
      const form = service.createPersonConsultationForm();
      expect(form.valid).toBe(false);

      form.setValue({
        name: 'Chinedu O',
        email: 'chinedu@diadem-consults.com',
        phone: '+2348012345678',
        notes: '',
      });
      expect(form.valid).toBe(true);
    });

    it('rejects an email without a dotted TLD', () => {
      const form = service.createPersonConsultationForm();
      form.controls.email.setValue('a@b');
      expect(form.controls.email.hasError('strictEmail')).toBe(true);
    });

    it('rejects a whitespace-only name', () => {
      const form = service.createPersonConsultationForm();
      form.controls.name.setValue('   ');
      expect(form.controls.name.valid).toBe(false);
    });

    it('normalises whitespace, case and phone punctuation, and attaches the slot', () => {
      const form = service.createPersonConsultationForm();
      form.setValue({
        name: '  Chinedu   O  ',
        email: 'Chinedu@Diadem-Consults.COM',
        phone: '+234 801-234 5678',
        notes: '   ',
      });

      expect(service.toPersonConsultation(form, SLOT)).toEqual({
        clientType: 'person',
        name: 'Chinedu O',
        email: 'chinedu@diadem-consults.com',
        phone: '+2348012345678',
        slot: SLOT,
      });
    });
  });

  describe('business consultation form', () => {
    it('requires business name and business email', () => {
      const form = service.createBusinessConsultationForm();
      expect(form.valid).toBe(false);

      form.setValue({
        businessName: 'Acme Ltd',
        businessEmail: 'hello@acme.io',
        notes: '',
      });
      expect(form.valid).toBe(true);
    });
  });

  describe('slot control', () => {
    it('is required', () => {
      const control = service.createSlotControl();
      expect(control.valid).toBe(false);
      control.setValue(SLOT.start);
      expect(control.valid).toBe(true);
    });
  });

  describe('request form', () => {
    it('enforces a minimum description length', () => {
      const form = service.createRequestForm();
      form.setValue({ requestName: 'API audit', description: 'too short', email: 'cto@acme.io' });
      expect(form.controls.description.valid).toBe(false);

      form.controls.description.setValue(
        'We need a full audit of our public REST API surface.'
      );
      expect(form.valid).toBe(true);
    });

    it('requires a reply email', () => {
      const form = service.createRequestForm();
      form.setValue({ ...REQUEST, email: '' });
      expect(form.controls.email.hasError('required')).toBe(true);
    });

    it('lower-cases the email', () => {
      const form = service.createRequestForm();
      form.setValue({ ...REQUEST, email: '  CTO@Acme.IO ' });
      expect(service.toRequestDetails(form).email).toBe('cto@acme.io');
    });
  });

  describe('submission', () => {
    it('flattens details and denormalises contact fields', () => {
      service
        .submitConsultation({
          clientType: 'person',
          name: 'Chinedu O',
          email: 'chinedu@diadem-consults.com',
          phone: '+2348012345678',
          slot: SLOT,
        })
        .subscribe();

      const req = httpMock.expectOne('/api/bookings');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.kind).toBe('consultation');
      expect(req.request.body.clientType).toBe('person');
      expect(req.request.body.slot).toEqual(SLOT);
      expect(req.request.body.displayName).toBe('Chinedu O');
      expect(req.request.body.replyTo).toBe('chinedu@diadem-consults.com');

      req.flush({
        reference: 'DC-8F2K1A',
        kind: 'consultation',
        status: 'pending',
        submittedAt: new Date().toISOString(),
        message: 'Received.',
      });

      expect(service.receipt()?.reference).toBe('DC-8F2K1A');
      expect(service.submitting()).toBe(false);
    });

    it('addresses requests to the given email', () => {
      service.submitRequest(REQUEST).subscribe();

      const req = httpMock.expectOne('/api/bookings');
      expect(req.request.body.kind).toBe('request');
      expect(req.request.body.displayName).toBe('API audit');
      expect(req.request.body.replyTo).toBe('cto@acme.io');
      req.flush({ reference: 'DC-AAAAAA', kind: 'request', status: 'pending', submittedAt: '', message: '' });
    });

    it('surfaces a server validation message on 422', () => {
      service.submitRequest(REQUEST).subscribe({ error: () => undefined });

      httpMock
        .expectOne('/api/bookings')
        .flush({ message: 'Description too vague.' }, {
          status: 422,
          statusText: 'Unprocessable Entity',
        });

      expect(service.error()).toBe('Description too vague.');
    });

    it('passes the status through on a slot clash', () => {
      let caught: unknown;
      service
        .submitConsultation({
          clientType: 'business',
          businessName: 'Acme Ltd',
          businessEmail: 'hello@acme.io',
          slot: SLOT,
        })
        .subscribe({ error: (e) => (caught = e) });

      httpMock
        .expectOne('/api/bookings')
        .flush({ message: 'That slot was just taken.' }, { status: 409, statusText: 'Conflict' });

      expect(caught instanceof BookingError).toBe(true);
      expect((caught as BookingError).status).toBe(409);
      expect(service.error()).toBe('That slot was just taken.');
    });

    it('does not retry client errors', () => {
      service.submitRequest(REQUEST).subscribe({ error: () => undefined });

      httpMock
        .expectOne('/api/bookings')
        .flush({}, { status: 400, statusText: 'Bad Request' });

      httpMock.verify(); // a retry would leave a second open request
    });
  });

  describe('status lookup', () => {
    it('normalises reference and email into query params', () => {
      service.lookupStatus(' dc-8f2k1a ', ' Me@Example.COM ').subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/bookings/status');
      expect(req.request.params.get('reference')).toBe('DC-8F2K1A');
      expect(req.request.params.get('email')).toBe('me@example.com');
      req.flush({});
    });
  });
});
