import { useQuery } from '@tanstack/react-query';import { getDynamicLookup, LookupRow } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from '../../components/ui/LookupField';

const AssignUserDiv = () => {
    const { user } = useAuth();

    const { data: divDropdownData, refetch } = useQuery({
        queryKey: ["divDropdownData"],
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: "DROP_DOWN_DIVISION",
                loginid: user?.loginid,
                code1: user?.company_code,
            });
            return Array.isArray(response) ? response : [];
        },
    })

    return (
        <div>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Assign User</span>
                <select className="ui-select ui-select-sm">
                    <option value="">Select User</option>
                    <option value="user1">User 1</option>
                    <option value="user2">User 2</option>
                    <option value="user3">User 3</option>
                </select>
            </div>
        </div>
    );
}


export default AssignUserDiv;