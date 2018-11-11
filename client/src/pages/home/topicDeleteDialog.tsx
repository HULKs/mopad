import * as React from "react";
import { injectIntl, InjectedIntl, FormattedMessage } from "react-intl";
import Dialog from "material-ui/Dialog";
import FlatButton from "material-ui/FlatButton";
import { TopicViewModel } from "../../business/topics";

interface Props {
    open: boolean;
    topic: TopicViewModel;
    onConfirm();
    onCancel();
}
interface IntlProps {
    intl: InjectedIntl;
}

export default injectIntl(function(props: Props & IntlProps) {
    const { open, topic, onConfirm, onCancel, intl } = props;
    const actions = [
        <FlatButton
            label={intl.formatMessage({
                id: "topic.delete.dialog.cancel"
            })}
            primary
            onClick={onCancel}
        />,
        <FlatButton
            label={intl.formatMessage({
                id: "topic.delete.dialog.confirm"
            })}
            primary
            onClick={onConfirm}
        />
    ];
    return (
        <Dialog
            open={open}
            title={intl.formatMessage({
                id: "topic.delete.dialog.title"
            })}
            actions={actions}
        >
            <FormattedMessage id="topic.delete.dialog.text" values={{ title: topic.title }} />
        </Dialog>
    );
});
