import * as React from "react";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import { AllLocationsQuery } from "../../mopad-graphql";
import { ApolloError } from "apollo-client";

type Location = AllLocationsQuery["allLocations"][0];

interface LocationSelectorOwnProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
}

interface LocationSelectorProps extends LocationSelectorOwnProps {
    error?: ApolloError;
    loading: boolean;
    locations: Location[];
}

function DisconnectedLocationSelector(props: LocationSelectorProps) {
    const { value, onChange, locations } = props;
    return (
        <FormControl fullWidth margin="normal">
            <InputLabel>Location</InputLabel>
            <Select
                value={value || ""}
                onChange={e => {
                    onChange(e.target.value || null);
                }}
            >
                <MenuItem key="none" value="">
                    ---
                </MenuItem>
                {(locations || []).map(l => (
                    <MenuItem key={l.id} value={l.id}>
                        {l.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

const ALL_LOCATIONS_QUERY = gql`
    query AllLocations {
        allLocations(orderBy: name_ASC) {
            id
            name
        }
    }
`;

const loadLocations = graphql<AllLocationsQuery, LocationSelectorOwnProps>(ALL_LOCATIONS_QUERY, {
    props: ({ data, ownProps }): LocationSelectorProps => ({
        ...ownProps,
        error: data.error,
        loading: data.loading,
        locations: data.allLocations
    })
});

export default compose(loadLocations)(DisconnectedLocationSelector);
