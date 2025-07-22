import { DynamoDBJobRepository } from '../../repositories/generic-job-repository';
import type { JobSignalRecord } from '../../types/amazon';

export class DynamoDBAmazonSignalRepository extends DynamoDBJobRepository<JobSignalRecord> {}
