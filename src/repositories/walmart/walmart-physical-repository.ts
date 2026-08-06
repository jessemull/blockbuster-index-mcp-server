import type { WalmartJobRecord } from '../../types/walmart';
import { DynamoDBJobRepository } from '../../repositories/generic-job-repository';

export class DynamoDBWalmartJobRepository extends DynamoDBJobRepository<WalmartJobRecord> {}
