import * as $ from 'jquery';
import salaries from './salaries';
import * as _ from 'lodash';
import "jquery-ui/ui/widgets/autocomplete";


$(function() {
    setInterval(renderBbfbl, 500)
    const playerSelector = '.ysf-player-name';
    const salariedSelector = ".bbfbl-salaried";    
    const MAX_SALARY_CUTOFF = 139000000
    let canDisplaySalaries = null
    let canDisplayTool = null
    let url = window.location.href
    
    function renderBbfbl() {
        if ($("body").hasClass('bbfbl') && url == window.location.href) {
            return;
        }
        renderSalaries()
        renderSalaryTool()
        $("body").addClass('bbfbl')
        url = window.location.href
    }

    function renderSalaries() {
        if (canDisplaySalaries === null) {
            const isPlayerListPage = window.location.pathname.indexOf("/players") > 0
            const isResearchPage = window.location.pathname.indexOf("/research") > 0
            const isPlayerPage = !isNaN(parseInt(window.location.pathname.split("/")[3], 10))
            if (isPlayerListPage || isResearchPage || isPlayerPage ) {
                canDisplaySalaries = true
            } else {
                canDisplaySalaries = false
            }
        }

        if (!canDisplaySalaries) {
            return;
        }

        console.log("rendering bbfbl salary...")
        const $players = $(playerSelector);
        const teamSalaries = [];

        $players.each(function() {
            const $this = $(this);
            const href = $this.find('a').attr('href');

            if (!href) return;
            const playerData = _.find(salaries, { yahoo_id: getId(href) });
            const value = playerData ? playerData.salary19_20 : 0;
            $this.append(renderSalary(value))
            $this.addClass('bbfbl-salaried');
            teamSalaries.push(value);
        })
        const hasSalaryDisplayed = $("#team-card-info .bbfbl-total-salary").length > 0;
        if (!hasSalaryDisplayed) {
            const totalSalary = sum(teamSalaries);
            renderTotalSalary(totalSalary);
        }
        const width  = window.location.href.indexOf('players') > 0 ? 230 : 255
        $('td .Ov-h ').css('width', width)
    }

    function sum(values: number[]) {
        return values.reduce((total, salary) => { return total + salary}, 0);
    }
    function renderTotalSalary(total: number) {
        const color = total < MAX_SALARY_CUTOFF ? '#0d8d40' : '#f33131'
        const css = {
            'color': color,
            'font-size': 10,
            'font-weight': 500
        }
        const elem = $(`<span class='bbfbl-total-salary'>${toDollarFormat(total)}</span>`);
        elem.css(css);
        $('#team-card-info .Pstart-lg li')
        .eq(0)
        .append(elem);
    }

    function renderSalaryTool() {
        console.log("rendering bbfbl tool...")
        if (canDisplayTool === null) {
            const isPlayerPage = !isNaN(parseInt(window.location.pathname.split("/")[3], 10))
            canDisplayTool = isPlayerPage
        }
        if (!canDisplayTool) {
            return
        }
        const buttonClasses = "Btn Btn-short Mend-med js-salary-tool-trigger salary-tool-trigger"
        const trigger = $(`<a class="${buttonClasses}">Salary Worksheet</a>`)
    
        setupContainer()
    
        const triggerAnchor = $(".Bdrbot .Ta-end")
        trigger.on("click", function(e) {
            onSalaryToolTriggerClick(e)
        })
        triggerAnchor.append(trigger)
    
        // Make it easy to dismiss
        $("body *:not('.salary-tool-trigger')").on("click", function(e) {
            const isWithinTool = $(e.target).closest(".salary-tool").length > 0 || $(e.target).closest(".player-col").length > 0 
            const isTrigger = $(e.target).hasClass("salary-tool-trigger")
            const isCancel = $(e.target).hasClass("cancel")
            if (!isWithinTool && !isTrigger && !isCancel) {
                $(".salary-tool").removeClass("show")
                $(".salary-tool-trigger").removeClass("active")
            }
        })
        
        renderToolBody()
        setupAutoComplete()
        setupCancelButton()
        calculateSalaryForYear()
        prepopulateSalaryTool()
    }
    
})

function renderSalary(str) {
    const css = {
        'color': '#0d8d40',
        'font-size': 10,
        'font-weight': 500
    }
    const $el = $(`<span>${toDollarFormat(str)}</span>`);
    $el.css(css);
    return $el;
}




function toDollarFormat(str) {
    if (!str) return "-"
    if (str === '???')
        return str;
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
    });
    return formatter.format(str)
}

function getId(href: string): number {
    const fragments = href.split('/');
    return parseInt(fragments[fragments.length - 1])
}



function setupContainer() {
    const toolContainer = $('<div class="js-salary-tool-container salary-tool arrow box"></div>')
    const toolAnchor = $("header.Bdrbot")
    toolContainer.insertAfter(toolAnchor)
    return toolContainer
}

function onSalaryToolTriggerClick(e: JQuery.Event) {
    $(e.target).toggleClass("active")
    var activeCss = {
        "height": 500
    }
    var hiddenCss = {
        "height": 0
    }
    var toolContainer = $(".salary-tool")
    toolContainer.toggleClass("show")
}

function renderToolBody() {
    
    var contentContainer = $('<div class="tool-content ui-widget"></div>')
    let table = `
                <table>
                <thead>
                    <tr>
                        <th>Player</td>
                        <th>Salary 2019 - 2020</td>
                        <th>Salary 2020 - 2021</td>
                        <th>Salary 2021 - 2022</td>
                        <th>Salary 2022 - 2023</td>            
                    </tr>
                </thead>
                <tbody>`
    const $players = $('.ysf-player-name');
    for (var i = 0; i < $players.length; i++) { 
        let row = `<tr class="player-row player-row-${i}">
                        <td class="player-col"><input class="player-input player-${i}"></td>
                        <td class="salary salary-19"></td>
                        <td class="salary salary-20"></td>
                        <td class="salary salary-21"></td>
                        <td class="salary salary-22"></td>
                  </tr>`
        table += row
    }

    let footer = `</tbody>
                    <tfoot>
                        <tr>
                            <td class="salary-footer xt"><strong>Total</strong></td>
                            <td class="salary-footer salary-19-sum"></td>
                            <td class="salary-footer salary-20-sum"></td>
                            <td class="salary-footer salary-21-sum"></td>
                            <td class="salary-footer salary-22-sum"></td>
                        </tr>
                    </tfoot>
                    </table>`
    table += footer
    contentContainer.append(table)
    $(".salary-tool").append(contentContainer)
}

function setupAutoComplete() {
    var source = salaries.map(s => {
        return { 
                    label: s.name, 
                    value: s.name, 
                    id: s.yahoo_id, 
                    salary19_20: s.salary19_20,
                    salary20_21: s.salary20_21,
                    salary21_22: s.salary21_22,
                    salary22_23: s.salary22_23,
                    salares: [s.salary19_20, s.salary20_21, s.salary21_22, s.salary22_23]
                }
    })
    $(".player-input").autocomplete({
        source: source,
        minLength: 2,
        select: function(event, ui) {
            const wrapper = generatePlayerWrapper(ui.item.label)

            var row = $(this).closest(".player-row")
            row.find(".player-col").append(wrapper)
            
            // Replace with static selection
            $(this).hide()
            row.find("td.salary").text("")
            row.find("td.salary")
                .each(function(i, el) {
                    $(el).text(toDollarFormat(ui.item.salares[i]))
                    $(el).data("salary", ui.item.salares[i])
                })
            
            row.find(".cancel").addClass("active")
            
            // Need to recalc whenever new selection is made
            calculateSalaryForYear()
            //  Reset raw selection
            $(this).val("")
            return false;
        } 
    })
}

function calculateSalaryForYear() {
    var totals = [".salary-19", ".salary-20", ".salary-21", ".salary-22"]

    totals.forEach(function(year) {
        let sum = 0;
        $(year).each(function() {
            const salary = $(this).data("salary");
            if (salary) {
                sum += salary
            }
        })
        const sumEl = $(year + "-sum")
        sumEl.text(toDollarFormat(sum))
        if (sum > 139000000) {
            sumEl.addClass("warning")
        } else {
            sumEl.removeClass("warning")
        }
    })

}

function setupCancelButton() {
    $(".player-col").on("click", ".cancel",  function() {
        // const anchor = $(this).closest('.')
        const row = $(this).closest(".player-row")
        row.hide();
        row.find("input").show()
        row.find("td.salary").text("").data("salary", 0)
        row.find(".player-display-wrap").remove();
        calculateSalaryForYear()
        row.show()
    })
}

function isPlayerElement(el) {
    const href = getHref(el)
    return href != null
}

function getHref(el) {
    const $el = $(el);
    return $el.find('a').attr('href');
}

function getPlayerSalaryInfo(el) {
    const href = getHref(el)
    return _.find(salaries, { yahoo_id: getId(href) });
}

function prepopulateSalaryTool() {
    const playerSelector = '.ysf-player-name';
    // Track index of players we find ont he page
    let playerIdx = 0;
    $(playerSelector).each(function(i) {
        if (!isPlayerElement(this)) {
            return
        }
        // Update row for player
        const playerData = getPlayerSalaryInfo(this)
        if (!playerData) {
            console.log("Missing salary for:", this, playerData)
            return
        }
        var row = $(".salary-tool .player-row").eq(playerIdx);
        row.find(".player-input").hide();
        
        const wrapper = generatePlayerWrapper(playerData.name)
        row.find(".player-col").append(wrapper)
        
        // Append salaries
        var salares = [playerData.salary19_20, playerData.salary20_21, playerData.salary21_22, playerData.salary22_23]
        row.find("td.salary")
        .each(function(n, el) {
            $(el).text(toDollarFormat(salares[n]))
            $(el).data("salary", salares[n])
        })
        row.find(".cancel").addClass("active")
        playerIdx++
    })
    calculateSalaryForYear()
}

function generatePlayerWrapper(label) {
    const wrapperClass = "player-display-wrap"        
    const wrapper = $(`<div><span>${label}</span><span class="cancel">x</span></div>`)
    wrapper.addClass(wrapperClass)
    return wrapper
}

