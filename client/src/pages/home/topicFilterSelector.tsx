import * as React from "react";
import { injectIntl, InjectedIntl } from "react-intl";
import DropDownMenu from "material-ui/DropDownMenu";
import MenuItem from "material-ui/MenuItem";

export type TopicFilterValue = "all-upcoming" | "my-upcoming" | "past";

interface TopicFilterSelectorProps {
    value: TopicFilterValue;
    onChange: (v: boolean) => void;
}

export default injectIntl<TopicFilterSelectorProps>(function TopicFilterSelector({
    intl,
    value,
    onChange
}: {
    intl: InjectedIntl;
    value: TopicFilterValue;
    onChange: (v: boolean) => void;
}) {
    return (
        <DropDownMenu
            value={value}
            onChange={(e, i, v) => {
                onChange(v);
            }}
        >
            <MenuItem
                value="all-upcoming"
                primaryText={intl.formatMessage({
                    id: "topics.filter.all"
                })}
            />
            <MenuItem
                value="my-upcoming"
                primaryText={intl.formatMessage({
                    id: "topics.filter.my"
                })}
            />
            <MenuItem
                value="past"
                primaryText={intl.formatMessage({
                    id: "topics.filter.past"
                })}
            />
        </DropDownMenu>
    );
});
