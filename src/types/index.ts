export interface CopadoMetadata {
  userStory: string;
  metadataName: string;
  lastCommitDate?: string;
  developer?: string;
  type?: string;
  [key: string]: any;
}

export interface Conflict {
  metadataName: string;
  type?: string;
  stories: ConflictStory[];
  latestStory: string;
  latestCommitDate: Date;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  daysBehind: number;
}

export interface ConflictStory {
  storyId: string;
  commitDate: Date;
  developer?: string;
  daysOld: number;
  isLatest: boolean;
}

export interface GitConfig {
  provider: 'github' | 'gitlab' | 'bitbucket';
  orgName: string;
  repoName: string;
  branchPrefix: string;
}