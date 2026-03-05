// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors

// Returns the meta object whose states should be used for the given indicator field.
// When indicator_field is a Link field, states are sourced from the linked DocType's meta.
frappe.get_indicator_states_meta = function (doctype, indicator_fieldname) {
	if (!indicator_fieldname) return frappe.get_meta(doctype);
	let field_def = frappe.meta.get_docfield(doctype, indicator_fieldname);
	if (field_def && field_def.fieldtype === "Link" && field_def.options) {
		return frappe.get_meta(field_def.options) || frappe.get_meta(doctype);
	}
	return frappe.get_meta(doctype);
};

frappe.has_indicator = function (doctype) {
	// returns true if indicator is present
	if (frappe.model.is_submittable(doctype)) {
		return true;
	} else if (
		(frappe.listview_settings[doctype] || {}).get_indicator ||
		frappe.workflow.get_state_fieldname(doctype)
	) {
		return true;
	} else if (
		frappe.meta.has_field(doctype, "enabled") ||
		frappe.meta.has_field(doctype, "disabled")
	) {
		return true;
	} else {
		let meta = frappe.get_meta(doctype);
		let indicator_fieldname = (meta && meta.indicator_field) || "status";
		if (frappe.meta.has_field(doctype, indicator_fieldname)) {
			let states_meta = frappe.get_indicator_states_meta(doctype, indicator_fieldname);
			if (states_meta && states_meta.states && states_meta.states.length) {
				return true;
			}
		}
	}
	return false;
};

frappe.get_indicator = function (doc, doctype, show_workflow_state) {
	if (doc.__unsaved) {
		return [__("Not Saved", null, doctype), "orange"];
	}

	if (!doctype) doctype = doc.doctype;

	let meta = frappe.get_meta(doctype);
	var workflow = frappe.workflow.workflows[doctype];
	var without_workflow = workflow ? workflow["override_status"] : true;

	var settings = frappe.listview_settings[doctype] || {};

	var is_submittable = frappe.model.is_submittable(doctype);
	let workflow_fieldname = frappe.workflow.get_state_fieldname(doctype);
	let indicator_fieldname = (meta && meta.indicator_field) || "status";
	let indicator_states_meta = frappe.get_indicator_states_meta(doctype, indicator_fieldname);

	let avoid_status_override = (frappe.workflow.avoid_status_override[doctype] || []).includes(
		doc[workflow_fieldname]
	);
	// workflow
	if (
		workflow_fieldname &&
		(!without_workflow || show_workflow_state) &&
		!avoid_status_override
	) {
		var value = doc[workflow_fieldname];
		if (value) {
			let colour = "";

			if (locals["Workflow State"][value] && locals["Workflow State"][value].style) {
				colour = {
					Success: "green",
					Warning: "orange",
					Danger: "red",
					Primary: "blue",
					Inverse: "black",
					Info: "light-blue",
				}[locals["Workflow State"][value].style];
			}
			if (!colour) colour = "gray";

			return [__(value, null, doctype), colour, workflow_fieldname + ",=," + value];
		}
	}

	// draft if document is submittable
	if (is_submittable && doc.docstatus == 0 && !settings.has_indicator_for_draft) {
		return [__("Draft", null, doctype), "red", "docstatus,=,0"];
	}

	// cancelled
	if (is_submittable && doc.docstatus == 2 && !settings.has_indicator_for_cancelled) {
		return [__("Cancelled", null, doctype), "red", "docstatus,=,2"];
	}

	// based on document state
	let indicator_value = doc[indicator_fieldname];
	if (
		indicator_value &&
		indicator_states_meta &&
		indicator_states_meta.states &&
		indicator_states_meta.states.find((d) => d.title === indicator_value)
	) {
		let state = indicator_states_meta.states.find((d) => d.title === indicator_value);
		let color_class = frappe.scrub(state.color, "-");
		return [__(indicator_value, null, doctype), color_class, indicator_fieldname + ",=," + indicator_value];
	}

	if (settings.get_indicator) {
		var indicator = settings.get_indicator(doc);
		if (indicator) return indicator;
	}

	// if submittable
	if (is_submittable && doc.docstatus == 1) {
		return [__("Submitted", null, doctype), "blue", "docstatus,=,1"];
	}

	// based on status (or configured indicator field)
	if (indicator_value) {
		return [
			__(indicator_value, null, doctype),
			frappe.utils.guess_colour(indicator_value),
			indicator_fieldname + ",=," + indicator_value,
		];
	}

	// based on enabled
	if (frappe.meta.has_field(doctype, "enabled")) {
		if (doc.enabled) {
			return [__("Enabled", null, doctype), "blue", "enabled,=,1"];
		} else {
			return [__("Disabled", null, doctype), "grey", "enabled,=,0"];
		}
	}

	// based on disabled
	if (frappe.meta.has_field(doctype, "disabled")) {
		if (doc.disabled) {
			return [__("Disabled", null, doctype), "grey", "disabled,=,1"];
		} else {
			return [__("Enabled", null, doctype), "blue", "disabled,=,0"];
		}
	}
};
