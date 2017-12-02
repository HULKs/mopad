import * as React from "react";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import DropDownMenu from "material-ui/DropDownMenu";
import MenuItem from "material-ui/MenuItem";
import { AllLocationsQuery } from "../../mopad-graphql";

type Location = AllLocationsQuery["allLocations"][0];

interface LocationSelectorProps {
    value: boolean;
    onChange: (v: boolean) => void;
    locations: Location[];
}

function DisconnectedLocationSelector(props: LocationSelectorProps) {
    const { value, onChange, locations } = props;
    return (
        <DropDownMenu
            style={{ minWidth: 200 }}
            value={value}
            onChange={(e, i, v) => {
                onChange(v);
            }}
        >
            <MenuItem key="none" value={null} primaryText="---" />
            {(locations || []).map(l => (
                <MenuItem key={l.id} value={l.id} primaryText={l.name} />
            ))}
        </DropDownMenu>
    );
}

const ALL_LOCATIONS_QUERY = gql`
    query AllLocations {
        allLocations {
            id
            name
        }
    }
`;

const loadLocations = graphql<AllLocationsQuery>(ALL_LOCATIONS_QUERY, {
    props: ({ data, ownProps }) => ({
        ...ownProps,
        error: data.error,
        loading: data.loading,
        locations: data.allLocations
    })
});

export default compose(loadLocations)(DisconnectedLocationSelector);
