import { createCompanyInputSchema, listCompaniesInputSchema, updateCompanyInputSchema, type CreateCompanyInput, type ListCompaniesInput, type UpdateCompanyInput } from "@auditrail/domain/generated/company";
import type { CompanyRepo } from "./repo.js";
export function createCompanyService(repo: CompanyRepo) {
  return {
    async archive(input: { id: string; organizationId: string }) {
      return repo.archive(input);
    },
    async create(input: { data: CreateCompanyInput; organizationId: string }) {
      const data = createCompanyInputSchema.parse(input.data);
      return repo.create({
        data,
        organizationId: input.organizationId
      });
    },
    async get(input: { id: string; organizationId: string }) {
      return repo.findById(input);
    },
    async list(input: { organizationId: string; filters: ListCompaniesInput }) {
      return repo.list({
        filters: listCompaniesInputSchema.parse(input.filters),
        organizationId: input.organizationId
      });
    },
    async unarchive(input: { id: string; organizationId: string }) {
      return repo.unarchive(input);
    },
    async update(input: { data: UpdateCompanyInput; id: string; organizationId: string }) {
      const data = updateCompanyInputSchema.parse(input.data);
      return repo.update({
        data,
        id: input.id,
        organizationId: input.organizationId
      });
    }
  };
}
