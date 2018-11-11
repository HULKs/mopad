import * as React from "react";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import { ApolloError } from "apollo-client";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import { AllTeamsQuery } from "../../mopad-graphql";

type Team = AllTeamsQuery["allTeams"][0];

interface TeamSelectorOwnProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
}
interface TeamSelectorProps extends TeamSelectorOwnProps {
    error?: ApolloError;
    loading: boolean;
    teams: Team[];
}

function DisconnectedTeamSelector(props: TeamSelectorProps) {
    const { label, value, onChange, teams } = props;
    return (
        <FormControl fullWidth margin="normal">
            <InputLabel>{label}</InputLabel>
            <Select
                fullWidth
                value={value || ""}
                onChange={e => {
                    onChange(e.target.value || null);
                }}
            >
                <MenuItem key="none" value="">
                    ---
                </MenuItem>
                {(teams || []).map(l => (
                    <MenuItem key={l.id} value={l.id}>
                        {l.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

const ALL_TEAMS_QUERY = gql`
    query AllTeams {
        allTeams(orderBy: name_ASC) {
            id
            name
        }
    }
`;

const loadTeams = graphql<AllTeamsQuery, TeamSelectorOwnProps>(ALL_TEAMS_QUERY, {
    props: ({ data, ownProps }): TeamSelectorProps => ({
        ...ownProps,
        error: data.error,
        loading: data.loading,
        teams: data.allTeams
    })
});
export default compose(loadTeams)(DisconnectedTeamSelector);
