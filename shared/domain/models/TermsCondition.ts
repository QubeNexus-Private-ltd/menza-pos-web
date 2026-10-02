export interface TermConditionStatusDTO {
  userId: number;
  name?: string;
  mobile?: string;
  isTermConditionChecked: boolean;
  roles?: string[];
  isOwner?: boolean;
}

export interface TermsConditionStatus {
  userId: number;
  isTermConditionChecked: boolean;
  isChecked?: boolean;
}

export interface UpdateTermsConditionRequest {
  userId: number;
  isTermConditionChecked: boolean;
  isChecked?: boolean;
}
