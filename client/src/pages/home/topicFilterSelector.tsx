import * as React from "react";
import { injectIntl, InjectedIntl } from "react-intl";
import DropDownMenu from "material-ui/DropDownMenu";
import MenuItem from "material-ui/MenuItem";

interface TopicFilterSelectorProps {
    value: boolean;
    onChange: (v: boolean) => void;
}

export default injectIntl<TopicFilterSelectorProps>(
    function TopicFilterSelector({
        intl,
        value,
        onChange
    }: {
        intl: InjectedIntl;
        value: boolean;
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
                    value={false}
                    primaryText={intl.formatMessage({
                        id: "topics.filter.all"
                    })}
                />
                <MenuItem
                    value={true}
                    primaryText={intl.formatMessage({
                        id: "topics.filter.my"
                    })}
                />
            </DropDownMenu>
        );
    }
);
