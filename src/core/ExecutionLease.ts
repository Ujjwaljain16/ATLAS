export enum LeaseState {
  LOCKED = 'LOCKED',
  RECOVERING = 'RECOVERING',
  UNREACHABLE = 'UNREACHABLE',
  COMPLETED = 'COMPLETED'
}

export interface ExecutionLease {
  target: { 
    elementId: string; 
    selector: string; 
    label: string; 
  };
  intendedAction: any;
  state: LeaseState;
  createdAt: number;
}
