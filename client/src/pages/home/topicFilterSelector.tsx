import * as React from "react";
import { injectIntl, InjectedIntl } from "react-intl";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import MenuItem from "@material-ui/core/MenuItem";

export type TopicFilterValue = "all-upcoming" | "my-upcoming" | "past";

interface TopicFilterSelectorProps {
    value: TopicFilterValue;
    onChange: (v: string) => void;
}

export default injectIntl<TopicFilterSelectorProps>(function TopicFilterSelector({
    intl,
    value,
    onChange
}: {
    intl: InjectedIntl;
    value: TopicFilterValue;
    onChange: (v: string) => void;
}) {
    return (
        <FormControl>
            <Select
                value={value}
                onChange={e => {
                    onChange(e.target.value);
                }}
            >
                <MenuItem value="all-upcoming">
                    {intl.formatMessage({
                        id: "topics.filter.all"
                    })}
                </MenuItem>
                <MenuItem value="my-upcoming">
                    {intl.formatMessage({
                        id: "topics.filter.my"
                    })}
                </MenuItem>
                <MenuItem value="past">
                    {intl.formatMessage({
                        id: "topics.filter.past"
                    })}
                </MenuItem>
            </Select>
        </FormControl>
    );
});
