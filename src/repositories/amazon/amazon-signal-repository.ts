import type { JobSignalRecord } from '../../types/amazon';
import { DynamoDBJobRepository } from '../../repositories/generic-job-repository';

export class DynamoDBAmazonSignalRepository extends DynamoDBJobRepository<JobSignalRecord> {}
