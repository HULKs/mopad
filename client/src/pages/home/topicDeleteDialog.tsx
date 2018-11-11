import * as React from "react";
import { injectIntl, InjectedIntl, FormattedMessage } from "react-intl";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import Button from "@material-ui/core/Button";
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

    return (
        <Dialog open={open}>
            <DialogTitle>
                {intl.formatMessage({
                    id: "topic.delete.dialog.title"
                })}
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <FormattedMessage
                        id="topic.delete.dialog.text"
                        values={{ title: topic.title }}
                    />
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button color="primary" onClick={onCancel}>
                    {intl.formatMessage({
                        id: "topic.delete.dialog.cancel"
                    })}
                </Button>
                <Button color="primary" onClick={onConfirm}>
                    {intl.formatMessage({
                        id: "topic.delete.dialog.confirm"
                    })}
                </Button>
            </DialogActions>
        </Dialog>
    );
});
