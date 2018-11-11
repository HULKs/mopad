import * as React from "react";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import { ApolloError } from "apollo-client";
import DropDownMenu from "material-ui/DropDownMenu";
import MenuItem from "material-ui/MenuItem";
import { AllTeamsQuery } from "../../mopad-graphql";

type Team = AllTeamsQuery["allTeams"][0];

interface TeamSelectorOwnProps {
    value: string;
    onChange: (v: string) => void;
}
interface TeamSelectorProps extends TeamSelectorOwnProps {
    error?: ApolloError;
    loading: boolean;
    teams: Team[];
}

function DisconnectedTeamSelector(props: TeamSelectorProps) {
    const { value, onChange, teams } = props;
    return (
        <DropDownMenu
            style={{ minWidth: 200 }}
            value={value}
            onChange={(e, i, v) => {
                onChange(v);
            }}
        >
            <MenuItem key="none" value={null} primaryText="---" />
            {(teams || []).map(l => (
                <MenuItem key={l.id} value={l.id} primaryText={l.name} />
            ))}
        </DropDownMenu>
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