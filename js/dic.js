if (!String.prototype.format) {

    //source for format function: http://stackoverflow.com/a/4673436/694987
    //currently unused, but matches C#'s usage. 
    //ex: "{0} {0} {1} {2}".formatWith("zero", "one") -> "zero zero one {2}"

    String.prototype.formatWith = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    };

    String.prototype.insert = function(value, index) {
        return this.substring(0, index) + value + this.substring(index, this.length);
    };
}

/**
 * We define namespaces to avoid any naming conflicts.  
 */
var dic = (function() {

    function namespace(name, parent) {
        parent = parent || dic;
        var namespaces = name.split('.');
        for (var i = 0; i < namespaces.length; i++) {
            var ns = namespaces[i];
            parent[ns] = parent[ns] || {};
        }
        return parent;
    }
    return {'namespace': namespace, editor: null};
})();
var editors = dic.namespace("editors");
var bindings = dic.namespace("editors.bindings");

/**
 * An Editor contains a textarea and cursor.
 * 
 * @param textarea
 *                  An HTML textarea element.
 */
editors.Editor = function(textarea) {
    var cursor = new editors.Cursor(textarea);

    this.getCursor = function() {
        return cursor;
    };

    this.getTextArea = function() {
        return textarea;
    };
};

/**
 * A Cursor represents a Editor's native cursor. It
 * contains information on the native cursor position,
 * and text selection ranges. It can also be moved.
 * 
 * @param textarea
 *                  An HTML textarea element.
 */
editors.Cursor = function(textarea) {
    this.move = function(start, end) {
        textarea.selectionStart = start;
        textarea.selectionEnd = end;
    };

    this.hasSelection = function() {
        return textarea.selectionStart !== textarea.selectionEnd;
    };

    this.getSelectionRange = function() {
        return {'start': textarea.selectionStart, 'end': textarea.selectionEnd};
    };

    this.getCursorPosition = function() {
        return textarea.selectionStart;
    };
};

/**
 *  A Binding maps a hot key combination and event to a handler.
 *  
 *  @param type 
 *              The event type. E.g keyup, keydown, keypress
 *              
 *  @param hotkeys
 *              The key combination for which the event and handler
 *              is mapped to. E.g. 'space', 'ctrl-c', 'alt-ctrl-z'
 *              
 *  @param evtHandler
 *              The event handler function. This function accepts
 *              an event.
 *          
 */
bindings.Binding = function(type, hotkeys, evtHandler) {
    this.type = type;
    this.hotkeys = hotkeys;
    this.evtHandler = evtHandler;
};
bindings.Binding.prototype.bind = function() {
    var tb = $(dic.editor.getTextArea());
    tb.bind(this.type, this.hotkeys, this.evtHandler);
};

/**
 * A TagBinding inserts a set of open and closing tags at the cursor 
 * for a specified hot key combination. If text is selected, the text
 * is wrapped in the tags.
 * 
 * @param hotkeys
 *              The key combination for which the event and handler
 *              is mapped to. E.g. 'space', 'ctrl-c', 'alt-ctrl-z'
 *             
 * @param startTag
 *              The opening tag to be inserted before the cursor. If 
 *              text is selected, the tag is inserted before the selection. 
 *              If the tag is null, nothing is inserted in its place.
 *              
 * @param endTag
 *              The closing tag to be inserted after the cursor. If 
 *              text is selected, the tag is inserted after the selection. 
 *              If the tag is null, nothing is inserted in its place.
 *              
 *  @param evtHandler
 *              The event handler function. This function accepts
 *              an event.
 */
bindings.TagBinding = function(hotkeys, startTag, endTag, evtHandler) {

    this.defaultHandler = function(evt)
    {
        evt.preventDefault();
        evt.stopPropagation();
        var cursor = dic.editor.getCursor();
        var textarea = dic.editor.getTextArea();
        if (cursor.hasSelection())
            wrapWithTags(cursor.getSelectionRange(), textarea);
        else
            insertTags(cursor, textarea);
    };

    function addTag(textarea, position, tag) {
        textarea.value = textarea.value.insert(tag, position);
    }

    function insertTags(cursor, textarea) {
        var position = cursor.getCursorPosition();
        if (startTag)
        {
            addTag(textarea, position, startTag);
            position += startTag.length;
        }
        if (endTag)
            addTag(textarea, position, endTag);
        cursor.move(position, position);
    }

    function wrapWithTags(selectionRange, textarea) {
        if (startTag)
            addTag(textarea, selectionRange.start, startTag);
        if (endTag)
        {
            if (startTag)
                addTag(textarea, selectionRange.end + startTag.length, endTag);
            else
                addTag(textarea, selectionRange.end, endTag);
        }
    }

    bindings.Binding.call(this, 'keydown', hotkeys, evtHandler || this.defaultHandler);
};
bindings.TagBinding.prototype = new bindings.Binding;

/**
 * A MemberTagBinding inserts the member tag at the cursor for a specified hot 
 * key combination. If text is selected, the tag is placed at the beginning 
 * of the selection. In addition to inserting the tag, a dialog is displayed 
 * where the user can select a DIC member whose name is placed in the tag value.
 * 
 * @param hotkeys
 *              The key combination for which the event is mapped to. E.g. 
 *              'space', 'ctrl-c', 'alt-ctrl-z'
 */
bindings.MemberTagBinding = function(hotkeys) {

    bindings.TagBinding.call(this, hotkeys, "[member='']", null,
            defaultHandler);

    var pHandler = this.defaultHandler;
    this.dialogCreated = false;

    function defaultHandler(evt)
    {
        var cursor = dic.editor.getCursor();
        var initCursorPosition = cursor.getCursorPosition();
        var hasSelection = cursor.hasSelection();
        pHandler.call(this, evt);
        var position = cursor.getCursorPosition() - 2;
        if (hasSelection)
            position = initCursorPosition + 9;
        cursor.move(position, position);
        createDialog();
    }

    /**
     * Insert the given user name in the quotes of the member tag, and
     * move the cursor forward 3 spaces.
     */
    function insertUserInTag(user)
    {
        var cursor = dic.editor.getCursor();
        var position = cursor.getCursorPosition();
        var textarea = dic.editor.getTextArea();
        textarea.value = textarea.value.insert(user, position) + " ";
        cursor.move(position + user.length + 3, position + user.length + 3);
    }

    /**
     * Return an array of the names of the DIC users who have posted
     * on the current page.
     */
    function getPageUsers()
    {
        var users = [];
        $("a.url.fn").each(function()
        {
            var username = $(this).html();
            if ($.inArray(username, users) === -1)
                users.push(username);
        });
        return users;
    }

    /**
     * Make an asynchronous AJAX call to get the names of the friends for 
     * the user with the given user id. If the user id doesn't exist, an 
     * empty array is returned, otherwise an array of names is returned.
     */
    function getUserFriends(userId)
    {
        var friends = [];
        $.ajax({
            type: "GET",
            dataType: "xml",
            url: "http://www.dreamincode.net/forums/xml.php",
            data: {"showuser": userId},
            async: false,
            success: function(data)
            {
                $(data).find("friends user name").each(function()
                {
                    friends.push($(this).text());
                });
            },
            error: function(jqXHR, textStatus, errorThrown)
            {
                //TODO alert message in dialog
            }
        });
        return friends;
    }

    //FUTURE TODOs
    //1. Make the dialog into a scrollable vertical list.
    //2. Up and down arrows should navigate the list
    //3. Enter should select and close
    //4. Text box available at top (or possibly side) of dialog for entering names not listed in thread. Should not be focused by default.

    function createDialog()
    {
        if (!this.dialogCreated)
        {
            //Get user friends
            var friends = getUserFriends(4803);
            var arrAsStr = "";
            for (var i in friends)
                arrAsStr += "\"" + friends[i] + "\",";
            arrAsStr = arrAsStr.substring(0, arrAsStr.length - 1);

            //Autocomplete JS code
            var dialog = "<script>$(function() { var members = [";
            dialog += arrAsStr;
            dialog += "]; $(\"#dialog-form-srch\").autocomplete({source:members});});";
            dialog += "</script>";

            //Dialog
            dialog += "<div id=\"dialog-form\" class=\"ui-widget\" title=\"Choose DIC Member\">";
            dialog += "<label for=\"dialog-form-srch\"><b>Name:&nbsp;</b></label>";
            dialog += "<input type=\"text\" size=\"40\" id=\"dialog-form-srch\" class=\"text ui-corner-all\" />";
            dialog += "&nbsp;<button id=\"dialog-form-srch-btn\">Choose</button>";
            dialog += "<br/><br/><table id=\"dialog-form-tbl\"></table></div>";

            //Add dialog html to page
            $("body").append(dialog);
            
            //Autocomplete button handler
            $("#dialog-form-srch-btn").button();
            $("#dialog-form-srch-btn").click(function()
            {
                var name = $("#dialog-form-srch").val();
                if (name)
                    insertUserInTag(name);
                $("#dialog-form").dialog("close");
            });

            //Add page user buttons in dialog table
            var pageUsers = getPageUsers();
            pageUsers.map(function(aUser)
            {
                var input = "<tr><td style=\"border-top:none\">";
                input += "<button>" + aUser + "</button></td></tr>";
                $('#dialog-form-tbl').append(input);
            });

            //Add handlers to page user buttons
            $("#dialog-form-tbl button").button();
            $("#dialog-form-tbl button").click(function()
            {
                insertUserInTag($(this).text());
                $("#dialog-form").dialog("close");
            });
            
            //Create dialog
            $("#dialog-form").dialog({
                autoOpen: false,
                height: 500,
                width: 450,
                dialog: true,
                open: function() {
                  //$("#dialog-form-tbl tr:first td button").focus();
                    //TODO
                },
                close: function() {
                    $("#dialog-form-srch").val("");
                    //$("#dialog-form-body").scrollTop(0);
                    //TODO
                    dic.editor.getTextArea().focus();
                }
            });
            
            //Create dialog once
            this.dialogCreated = true;
        }
        
        $("#dialog-form").dialog("open");
    }
};
bindings.MemberTagBinding.prototype = new bindings.TagBinding;

/**
 * A UrlTagBinding inserts URL tags at the cursor or around
 * selected text. If text starting with 'http://' is copied 
 * to the clipboard, it's inserted into tag url attribute value.
 * 
 * @param hotkeys
 *              The key combination for which the event is mapped to. E.g. 
 *              'space', 'ctrl-c', 'alt-ctrl-z'
 */
bindings.UrlTagBinding = function(hotkeys) {

    bindings.TagBinding.call(this, hotkeys, "[url='']", '[/url]',
            defaultHandler);

    var pHandler = this.defaultHandler;

    function defaultHandler(evt)
    {
        var cursor = dic.editor.getCursor();
        var hasSelection = cursor.hasSelection();
        var selectionRange = cursor.getSelectionRange();
        var textLength = selectionRange.end - selectionRange.start;
        pHandler.call(this, evt);
        var position = cursor.getCursorPosition();
        if (hasSelection)
            position -= textLength + 8;
        else
            position -= 2;
        cursor.move(position, position);
        chrome.runtime.sendMessage({text: "urlBinding"}, function(response)
        {
            var textarea = dic.editor.getTextArea();
            textarea.value = textarea.value.insert(response.val, position);
            position = cursor.getCursorPosition();
            cursor.move(position - 6, position - 6);
        });
    }
};
bindings.UrlTagBinding.prototype = new bindings.TagBinding;

/**
 * A MacroBinding replaces a specified character sequence or regular 
 * expression with another specified character sequence. All instances of 
 * the replaceable sequence are replaced.
 * 
 * @param hotkeys
 *              The key combination that invokes the replacement.
 *              E.g. 'space', 'ctrl-c', 'alt-ctrl-z'
 *             
 * @param macro
 *              A character sequence or regular expression to be
 *              replaced. If a regular expression is given, it can't
 *              contain flags.
 *              
 * @param expand
 *              The replacement sequence.
 */
bindings.MacroBinding = function(hotkeys, macro, expand) {

    bindings.Binding.call(this, 'keyup', hotkeys,
            function(evt) {
                evt.preventDefault();
                evt.stopPropagation();
                var textarea = dic.editor.getTextArea();
                var regex = new RegExp(macro, 'g');
                textarea.value = textarea.value.replace(regex, expand);
            }
    );
};
bindings.MacroBinding.prototype = new bindings.Binding;

/**
 * A TabBinding tabs the editor's cursor and the text in
 * front of the cursor to the right. If text is selected,
 * the entire text selection is tabbed.
 */
bindings.TabBinding = function() {

    this.defaultHandler = function(evt)
    {
        evt.preventDefault();
        evt.stopPropagation();
        var cursor = dic.editor.getCursor();
        var position = cursor.getCursorPosition();
        var textarea = dic.editor.getTextArea();
        var hasSelection = cursor.hasSelection();
        var selectionRange = cursor.getSelectionRange();
        if (hasSelection)
        {
            var start = selectionRange.start;
            var end = selectionRange.end;
            var selectedText = textarea.value.substring(start, end);
            var regex = new RegExp("(\\n\\t*)", 'g');
            var tabbedText = "\t" + selectedText.replace(regex, "$1\t");
            var newText = textarea.value.substring(0, start);
            newText += tabbedText;
            newText += textarea.value.substring(end);
            textarea.value = newText;
            cursor.move(position + 1, position + 1);
        } else {
            textarea.value = textarea.value.insert("\t", position);
            cursor.move(position + 1, position + 1);
        }
    };
    bindings.Binding.call(this, 'keydown', 'tab', this.defaultHandler);
};
bindings.TabBinding.prototype = new bindings.Binding;


/**
 * 1. Create the bindings from local storage.
 * 2. Apply bindings to sole text editor on page if it exists
 * 3. When a dynamic editor is added (post edit), find it and add
 *    the bindings. Also add a handler to make it the active editor 
 *    when clicked.
 */
$(document).ready(function() {

    //(1)
    var binds = [
        new bindings.TagBinding('ctrl+b', '[b]', '[/b]'),
        new bindings.TagBinding('ctrl+i', '[i]', '[/i]'),
        new bindings.TagBinding('ctrl+u', '[u]', '[/u]'),
        new bindings.TagBinding('ctrl+k', '[il]', '[/il]'),
        new bindings.TagBinding('ctrl+q', '[quote]', '[/quote]'),
        new bindings.TagBinding('ctrl+p', '[img]', '[/img]'),
        new bindings.TagBinding('ctrl+shift+c', '[code]', '[/code]'),
        new bindings.MemberTagBinding('ctrl+m'),
        new bindings.UrlTagBinding('ctrl+l'),
        new bindings.TabBinding(),
        new bindings.MacroBinding('space', 'asap', 'as soon as possible'),
        new bindings.MacroBinding('space', 'lol', 'laugh out loud')
    ];

    //(2)
    var allEditors = [];
    var elems = $('div .editor textarea');
    var textarea = elems[0];
    if (textarea)
    {
        dic.editor = new editors.Editor(textarea);
        allEditors.push(dic.editor);
        for (var i = 0; i < binds.length; i++)
            binds[i].bind();
        elems.click(function()
        {
            dic.editor = findEditor(textarea);
        });
        elems.trigger('click');
    }

    //(3)
    $(".post.entry-content").on('DOMNodeInserted', function(elem) {
        if (elem.target.className === "ips_editor")
            addEditorBindings();
    });

    function addEditorBindings()
    {
        var currEditor = dic.editor;
        $('div .editor textarea').each(function()
        {
            var ta = $(this).get(0);
            if (!findEditor(ta))
            {
                dic.editor = new editors.Editor(ta);
                allEditors.push(dic.editor);
                for (var j = 0; j < binds.length; j++)
                    binds[j].bind();
                $(this).click(function()
                {
                    dic.editor = findEditor(ta);
                });
            }
        });
        dic.editor = currEditor;
    }

    function findEditor(ta)
    {
        var res = null;
        allEditors.map(function(editor)
        {
            if (editor.getTextArea() === ta)
                res = editor;
        });
        return res;
    }
});

//CURRENT TODOs:
//      (1) Fix UrlTag binding
//      (2) MemberTag TODOs

//FUTURE TODOs: 
//      (1) Create options page where user can add bindings
//      (2) When (1) is completed, get bindings from local storage
//      (3) Finish README
//      (4) Discuss uploading the extension as .crx file in repo
//      (5) Add instructions in README for adding new bindings in the code