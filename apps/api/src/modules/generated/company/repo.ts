import type { CreateCompanyInput, CompanyRecord, ListCompaniesInput, ListCompaniesResponse, UpdateCompanyInput } from "@auditrail/domain/generated/company";
export interface CompanyRepo {
  archive(input: { id: string; organizationId: string }): Promise<CompanyRecord | undefined>;
  create(input: { organizationId: string; data: CreateCompanyInput }): Promise<CompanyRecord>;
  findById(input: { id: string; organizationId: string }): Promise<CompanyRecord | undefined>;
  list(input: { organizationId: string; filters: ListCompaniesInput }): Promise<ListCompaniesResponse>;
  unarchive(input: { id: string; organizationId: string }): Promise<CompanyRecord | undefined>;
  update(input: { id: string; organizationId: string; data: UpdateCompanyInput }): Promise<CompanyRecord | undefined>;
}
