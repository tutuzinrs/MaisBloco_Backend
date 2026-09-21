import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type ReportEvent =
  | { type: 'reports:open-count'; total: number };

@Injectable()
export class ReportsEventsService {
  private readonly source = new Subject<ReportEvent>();

  readonly events$ = this.source.asObservable();

  emitOpenCount(total: number) {
    this.source.next({ type: 'reports:open-count', total });
  }
}